import type * as React from "react";

declare module "*.jsx" {
  const component: React.ComponentType<any>;
  export default component;
}

