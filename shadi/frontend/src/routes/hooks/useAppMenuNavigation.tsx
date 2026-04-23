import { IAppMenuItem } from "@/types/layout";
import { ArrowLeftRight, GitPullRequestArrow } from "lucide-react";

const useAppMenuNavigation = () => {
  const appMenuItems: IAppMenuItem[] = [
    {
      label: "transactions",
      link: "/admin",
      Icon: () => <ArrowLeftRight />,
    },
    {
      label: "join_requests",
      link: "/admin/join-requests",
      Icon: () => <GitPullRequestArrow />,
    },
  ];

  return {
    appMenuItems,
  };
};

export default useAppMenuNavigation;
