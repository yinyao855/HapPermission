#!/usr/bin/env node
import { Command } from 'commander';
import { getToolConfiguration, ToolConfiguration } from './toolbox.config';
import { Plugin, PluginOptions } from './index';

// 工具箱命令类
class ToolBoxCommander {
  program: Command;

  constructor() {
    this.program = new Command();
  }

  // 添加插件命令
  addPluginCommand(plugin: Plugin) {
    const pluginOption: PluginOptions = plugin.getPluginOptions();
    if (!pluginOption) {
      return;
    }
    const pluginCommand = this.program
      .name(pluginOption.name)
      .description(pluginOption.description)
      .version(pluginOption.version)
      .action((opts) => {
        plugin.start(opts).then(() => plugin.stop()).catch(e => {
          console.error(e);
          plugin.stop();
        });
      });
    pluginOption.commands.forEach((command) => {
      if (command.isRequiredOption) {
        pluginCommand.requiredOption(...command.options);
      } else {
        pluginCommand.option(...command.options);
      }
    });
  }

  buildCommands() {
    this.program.parse();
  }
}

// 工具箱入口类
class ToolboxEntry {
  commandBuilder: ToolBoxCommander;

  constructor() {
    this.commandBuilder = new ToolBoxCommander();
  }

  runPlugins() {
    const configuration: ToolConfiguration = getToolConfiguration();
    configuration.plugins.forEach((plugin) => {
      this.commandBuilder.addPluginCommand(plugin);
    });
    this.commandBuilder.buildCommands();
  }
}

// 主函数
function main() {
  const entry = new ToolboxEntry();
  entry.runPlugins();
}

// 执行主函数
main();
