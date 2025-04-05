import {AppApiCollectorPlugin} from '../index';

export type ToolConfiguration = {
  plugins: AppApiCollectorPlugin[];
};

// 获取工具箱配置
export function getToolConfiguration(): ToolConfiguration {
  return {
    plugins: [new AppApiCollectorPlugin()],
  };
}
