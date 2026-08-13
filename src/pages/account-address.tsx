import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Container } from "@/components/dental/Container";
import { SavedClinicLocationsManager } from "@/components/dental/SavedClinicLocationsManager";

export default function AccountAddress() {
  return <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14"><Container className="overflow-x-clip"><div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7"><AccountSidebar /><SavedClinicLocationsManager addressBook /></div></Container></div>;
}
