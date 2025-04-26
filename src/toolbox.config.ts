import {AppApiPermissionPlugin} from './index';

export type ToolConfiguration = {
  plugins: AppApiPermissionPlugin[];
};

// 获取工具箱配置
export function getToolConfiguration(): ToolConfiguration {
  return {
    plugins: [new AppApiPermissionPlugin()],
  };
}
