import { loadFont as loadBricolageGrotesque } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadFiraCode } from "@remotion/google-fonts/FiraCode";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadSyne } from "@remotion/google-fonts/Syne";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subs = ["latin"] as any;

loadBricolageGrotesque("normal", { weights: ["200","300","400","500","600","700","800"], subsets: subs });
loadFiraCode("normal", { weights: ["300","400","500","600","700"], subsets: subs });
loadInter("normal", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadInter("italic", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadJetBrainsMono("normal", { weights: ["100","200","300","400","500","600","700","800"], subsets: subs });
loadJetBrainsMono("italic", { weights: ["100","200","300","400","500","600","700","800"], subsets: subs });
loadLora("normal", { weights: ["400","500","600","700"], subsets: subs });
loadLora("italic", { weights: ["400","500","600","700"], subsets: subs });
loadMerriweather("normal", { weights: ["300","400","500","600","700","800","900"], subsets: subs });
loadMerriweather("italic", { weights: ["300","400","500","600","700","800","900"], subsets: subs });
loadMontserrat("normal", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadMontserrat("italic", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadPlayfairDisplay("normal", { weights: ["400","500","600","700","800","900"], subsets: subs });
loadPlayfairDisplay("italic", { weights: ["400","500","600","700","800","900"], subsets: subs });
loadPoppins("normal", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadPoppins("italic", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadRoboto("normal", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadRoboto("italic", { weights: ["100","200","300","400","500","600","700","800","900"], subsets: subs });
loadSpaceGrotesk("normal", { weights: ["300","400","500","600","700"], subsets: subs });
loadSyne("normal", { weights: ["400","500","600","700","800"], subsets: subs });
