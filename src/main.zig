const std = @import("std");
const runner = @import("runner");
const native_sdk = @import("native_sdk");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);

const worker_port: u16 = 4817;

const dev_origins = [_][]const u8{ "zero://app", "http://127.0.0.1:5173" };

const bridge_origins = [_][]const u8{ "zero://app", "zero://inline", "http://127.0.0.1:5173" };
const app_commands = [_]native_sdk.BridgeCommandPolicy{
    .{ .name = "app.workerInfo", .origins = &bridge_origins },
    .{ .name = "app.new", .origins = &dev_origins },
    .{ .name = "app.save", .origins = &dev_origins },
    .{ .name = "app.import", .origins = &dev_origins },
    .{ .name = "app.export", .origins = &dev_origins },
    .{ .name = "app.settings", .origins = &dev_origins },
};

const builtin_commands = [_]native_sdk.BridgeCommandPolicy{
    .{ .name = "native-sdk.dialog.openFile", .origins = &dev_origins },
    .{ .name = "native-sdk.dialog.saveFile", .origins = &dev_origins },
    .{ .name = "native-sdk.dialog.showMessage", .origins = &dev_origins },
    .{ .name = "native-sdk.webview.toggleDevTools", .origins = &dev_origins },
    .{ .name = "native-sdk.os.showNotification", .origins = &dev_origins },
    .{ .name = "native-sdk.platform.supports", .origins = &dev_origins },
};

const App = struct {
    env_map: *std.process.Environ.Map,
    io: std.Io,
    allocator: std.mem.Allocator,
    token_buf: [32]u8 = undefined,
    token_len: usize = 0,
    child: ?std.process.Child = null,
    handlers: [1]native_sdk.bridge.Handler = undefined,

    fn app(self: *@This()) native_sdk.App {
        return .{
            .context = self,
            .name = "lumiveo",
            .source = native_sdk.frontend.productionSource(.{ .dist = "frontend/dist" }),
            .source_fn = source,
            .start_fn = start,
            .event_fn = event,
            .stop_fn = stop,
        };
    }

    fn event(context: *anyopaque, runtime: *native_sdk.Runtime, event_value: native_sdk.Event) anyerror!void {
        _ = context;
        switch (event_value) {
            .command => |cmd| {
                if (std.mem.eql(u8, cmd.name, "app.new")) {
                    runtime.emitWindowEvent(1, "app.new", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.save")) {
                    runtime.emitWindowEvent(1, "app.save", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.import")) {
                    runtime.emitWindowEvent(1, "app.import", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.export")) {
                    runtime.emitWindowEvent(1, "app.export", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.settings")) {
                    runtime.emitWindowEvent(1, "app.settings", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.undo")) {
                    runtime.emitWindowEvent(1, "app.undo", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.redo")) {
                    runtime.emitWindowEvent(1, "app.redo", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.cut")) {
                    runtime.emitWindowEvent(1, "app.cut", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.copy")) {
                    runtime.emitWindowEvent(1, "app.copy", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.paste")) {
                    runtime.emitWindowEvent(1, "app.paste", "{}") catch {};
                } else if (std.mem.eql(u8, cmd.name, "app.selectAll")) {
                    runtime.emitWindowEvent(1, "app.selectAll", "{}") catch {};
                }
            },
            else => {},
        }
    }

    fn source(context: *anyopaque) anyerror!native_sdk.WebViewSource {
        return native_sdk.frontend.sourceFromEnv((@as(*App, @ptrCast(@alignCast(context))).env_map), .{
            .dist = "frontend/dist",
            .entry = "index.html",
        });
    }

    fn token(self: *const @This()) []const u8 {
        return self.token_buf[0..self.token_len];
    }

    fn generateToken(self: *@This()) void {
        var bytes: [16]u8 = undefined;
        self.io.random(&bytes);
        const alphabet = "0123456789abcdef";
        for (bytes, 0..) |byte, index| {
            self.token_buf[index * 2] = alphabet[byte >> 4];
            self.token_buf[index * 2 + 1] = alphabet[byte & 0x0f];
        }
        self.token_len = 32;
    }

    /// The frontend asks the shell where the local worker lives and which
    /// per-launch token to present. Keeping this on the bridge means the
    /// packaged, static frontend never embeds a credential.
    fn workerInfo(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        const self: *@This() = @ptrCast(@alignCast(context));
        return std.fmt.bufPrint(output, "{{\"url\":\"http://127.0.0.1:{d}\",\"token\":\"{s}\"}}", .{ worker_port, self.token() });
    }

    fn bridgeDispatcher(self: *@This()) native_sdk.BridgeDispatcher {
        self.handlers = .{
            .{ .name = "app.workerInfo", .context = self, .invoke_fn = workerInfo },
        };
        return .{
            .policy = .{ .enabled = true, .commands = &app_commands },
            .registry = .{ .handlers = &self.handlers },
        };
    }

    fn start(context: *anyopaque, runtime: *native_sdk.Runtime) anyerror!void {
        _ = runtime;
        const app_ptr = @as(*App, @ptrCast(@alignCast(context)));
        if (app_ptr.env_map.get("APP_DEMO_WORKER_EXTERNAL") != null) return;

        // ... rest of the code ...
        var exe_buf: [std.Io.Dir.max_path_bytes]u8 = undefined;
        const exe_len = std.process.executablePath(app_ptr.io, &exe_buf) catch return;
        const exe_dir = std.fs.path.dirname(exe_buf[0..exe_len]) orelse return;
        const contents_dir = std.fs.path.dirname(exe_dir) orelse return;

        const worker_root = std.fs.path.join(app_ptr.allocator, &.{ contents_dir, "Resources", "dist", "worker" }) catch return;
        defer app_ptr.allocator.free(worker_root);
        const node_path = std.fs.path.join(app_ptr.allocator, &.{ worker_root, "node" }) catch return;
        defer app_ptr.allocator.free(node_path);
        std.Io.Dir.cwd().access(app_ptr.io, node_path, .{}) catch return;
        const script_path = std.fs.path.join(app_ptr.allocator, &.{ worker_root, "dist", "server.js" }) catch return;
        defer app_ptr.allocator.free(script_path);

        const token_arg = std.fmt.allocPrint(app_ptr.allocator, "--token={s}", .{app_ptr.token()}) catch return;
        defer app_ptr.allocator.free(token_arg);
        const port_arg = std.fmt.allocPrint(app_ptr.allocator, "--port={d}", .{worker_port}) catch return;
        defer app_ptr.allocator.free(port_arg);
        const render_arg = std.fmt.allocPrint(app_ptr.allocator, "--render-entry={s}/render-src/render-entry.tsx", .{worker_root}) catch return;
        defer app_ptr.allocator.free(render_arg);

        app_ptr.child = std.process.spawn(app_ptr.io, .{
            .argv = &.{ node_path, script_path, token_arg, port_arg, render_arg },
            .stdin = .ignore,
            .stdout = .ignore,
            .stderr = .inherit,
        }) catch null;
    }

    fn stop(context: *anyopaque, runtime: *native_sdk.Runtime) anyerror!void {
        _ = runtime;
        const app_ptr: *App = @ptrCast(@alignCast(context));
        if (app_ptr.child) |*child| {
            child.kill(app_ptr.io);
            app_ptr.child = null;
        }
    }
};

pub fn main(init: std.process.Init) !void {
    var app = App{
        .env_map = init.environ_map,
        .io = init.io,
        .allocator = init.arena.allocator(),
    };
    app.generateToken();
    try runner.runWithOptions(app.app(), .{
        .app_name = "Lumiveo",
        .window_title = "Lumiveo",
        .bundle_id = "com.lumiveo.app",
        .icon_path = "assets/icon.png",
        .bridge = app.bridgeDispatcher(),
        .builtin_bridge = .{ .enabled = true, .commands = &builtin_commands },
        .security = .{
            .navigation = .{ .allowed_origins = &dev_origins },
        },
    }, init);
}

test "bridge worker info renders url and token" {
    var app = App{
        .env_map = undefined,
        .io = std.testing.io,
        .allocator = std.testing.allocator,
    };
    app.generateToken();
    var output: [256]u8 = undefined;
    const invocation: native_sdk.bridge.Invocation = .{
        .request = .{ .id = "t", .command = "app.workerInfo" },
        .source = .{},
    };
    const json = try App.workerInfo(&app, invocation, &output);
    try std.testing.expect(std.mem.indexOf(u8, json, "\"url\":\"http://127.0.0.1:4817\"") != null);
    try std.testing.expect(std.mem.indexOf(u8, json, app.token()) != null);
    try std.testing.expectEqual(@as(usize, 32), app.token_len);
}
