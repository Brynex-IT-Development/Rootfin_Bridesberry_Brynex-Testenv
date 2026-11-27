import rootfinLogoText from "../assets/rootfin-logo-text.png";
import rootfinLogoArrow from "../assets/rootfin-logo-arrow.png";

/**
 * Full-screen RootFin Reloading / Splash Screen with the brand logo
 * and the purple arrow growing upward smoothly.
 */
const RootfinLoader = ({ visible = true, fading = false, fullScreen = true }) => {
  if (!visible) return null;

  return (
    <div
      className={`rf-loader-screen ${
        fullScreen ? "fixed inset-0 z-[999999]" : "w-full min-h-[260px]"
      } flex flex-col items-center justify-center bg-[#0D0B12] transition-opacity duration-500 select-none ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="status"
      aria-label="Loading RootFin"
    >
      {/* Subtle purple radial ambient glow */}
      <div
        className="pointer-events-none absolute w-[360px] h-[360px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(242, 87, 43, 0.65) 0%, rgba(242, 87, 43, 0) 70%)",
        }}
      />

      {/* Centered Logo with Upward-Growing Purple Arrow */}
      <div className="relative flex flex-col items-center gap-5 z-10">
        <div className="relative inline-flex items-center h-[28px] sm:h-[32px]">
          <img
            src={rootfinLogoText}
            alt="ROOTFIN"
            className="h-[28px] sm:h-[32px] w-auto object-contain block pointer-events-none"
            draggable={false}
          />
          <img
            src={rootfinLogoArrow}
            alt=""
            aria-hidden="true"
            className="rf-loader-arrow absolute inset-0 h-[28px] sm:h-[32px] w-auto object-contain pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Minimalist purple progress bar */}
        <div className="w-[130px] h-[2.5px] rounded-full bg-white/10 overflow-hidden">
          <div className="rf-loader-bar h-full rounded-full bg-gradient-to-r from-[#F2572B] via-[#F46A43] to-[#F9A88E]" />
        </div>
      </div>
    </div>
  );
};

export default RootfinLoader;
