import { Link } from "react-router-dom";
import Header from "./Header";
import useSidebar from "../hooks/useSidebar";

/** Shown when someone opens a page that the subscription has hidden. */
const NotInPlan = () => {
  const isSidebarOpen = useSidebar();
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Not available" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        <div className="p-5 md:p-6">
          <div className="max-w-[460px] bg-white rounded-[12px] border border-[#E5E5E5] px-5 py-4">
            <p className="text-[14px] font-semibold text-[#212121]">This page isn&apos;t included in your plan</p>
            <p className="mt-1 text-[13px] text-[#6A6A6A]">Contact your software provider to add it to your subscription.</p>
            <Link to="/" className="mt-3 inline-block text-[13px] font-medium text-[#F2572B] hover:text-[#D9461D]">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotInPlan;
