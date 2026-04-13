import { ComponentType, FC } from "react";
import { RouteConfigs } from "../types";

const routeHOC =
  <ComponentProps extends object>(configs: RouteConfigs) =>
  (Component: ComponentType<ComponentProps>) => {
    const { title } = configs;
    document.title = title;

    const WrappedComponent: FC<ComponentProps> = (props) => {
      // If pageAccessName is not provided, then the page is accessible to all users
      // if (!pageAccessName) return <Component {...props} />;

      // const pageAccessRight = pageAccessRights.get(pageAccessName);

      // // If pageAccessName is undefined in the pageAccessRights map, then the page is accessible to all users
      // if (!pageAccessRight) return <Component {...props} />;

      // const hasAccess = pageAccessRight.roles.includes(userRole);

      // if (!hasAccess) return <Navigate to="/access-denied" replace={true} />;

      return <Component {...props} />;
    };

    return WrappedComponent;
  };

export default routeHOC;
