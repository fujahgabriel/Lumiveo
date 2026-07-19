import { Clapperboard } from "lucide-react";
import { APP_NAME } from "../lib/constants";

export function BrandHeader() {
  return (
    <div className="brand no-drag">
      <span className="brand-mark">
        <Clapperboard size={17} />
      </span>
      <strong>{APP_NAME} Studio</strong>
      <span className="beta-pill">PREVIEW</span>
    </div>
  );
}
export default BrandHeader;
