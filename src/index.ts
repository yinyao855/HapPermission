import { ApiPermission, MultiProjectApiPermission } from './api_permission';
import { Logger } from './utils';
import path from 'path';
import fs from 'fs';

export type OptionConfig = {
  isRequiredOption: boolean;
  options: [string, string];
};

// 插件可选项
export type PluginOptions = {
  name: string;
  version: string;
  description: string;
  commands: OptionConfig[];
}

// Plugin 接口
export interface Plugin {
  getPluginOptions(): PluginOptions;
  start(opts: any): Promise<void>;
  stop(): void;
}

// 定义命令行参数的类型
export type CommandArgs = {
  appName?: string;
  appDir?: string;
  sdk?: string;
  output?: string;
  format?: 'json' | 'excel' | 'csv';
  scanTest?: boolean;
  debug?: boolean;
  noRepeat?: boolean;
  config?: string;
  createConfig?: string;
};

export class AppApiPermissionPlugin implements Plugin {
  // 日志标签
  logTag: string;

  constructor() {
    this.logTag = 'AppApiPermissionPlugin';
  }

  getPluginOptions(): PluginOptions {
    return {
      name: 'HapPermission',
      version: '0.1.0',
      description: 'A permission analysis tool based on ArkAnalyzer.',
      commands: [
        {
          isRequiredOption: false,
          options: ['--appName <string>', 'app name'],
        },
        {
          isRequiredOption: false,
          options: ['--appDir <string>', 'app root directory'],
        },
        {
          isRequiredOption: false,
          options: ['--sdk <string>', 'sdk path, need to specify the ets directory, e.g sdk-root/version/ets'],
        },
        {
          isRequiredOption: false,
          options: ['--output <string>', 'the path to output the report'],
        },
        {
          isRequiredOption: false,
          options: ['--format <json,excel,csv>', 'format of the output report'],
        },
        {
          isRequiredOption: false,
          options: ['--scanTest', 'scan ohosTest'],
        },
        {
          isRequiredOption: false,
          options: ['--debug', 'output debug logs'],
        },
        {
          isRequiredOption: false,
          options: ['--noRepeat', 'apiInfos is not repeat']
        },
        {
          isRequiredOption: false,
          options: ['--config <string>', 'config file path'],
        },
        {
          isRequiredOption: false,
          options: ['--createConfig <string>', 'create config file in directory'],
        }
      ],
    };
  }

  async start(argv: CommandArgs) {
    if (!this.checkArguments(argv)) {
      return;
    }
    const startTime = Date.now();
    if (argv.createConfig) {
      const configPath = path.resolve(argv.createConfig);
      if (!fs.existsSync(configPath)) {
          fs.mkdirSync(configPath, { recursive: true });
      }
      const configFilePath = path.join(configPath, 'haper-config.json');
      if (!fs.existsSync(configFilePath)) {
        // 拷贝模版文件
        const templatePath = path.resolve(__dirname, './assets/template-config.json');
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        fs.writeFileSync(configFilePath, templateContent, 'utf-8');
        Logger.info(this.logTag, `config file created in ${configFilePath}`);
      } else {
        Logger.error(this.logTag, `${configFilePath} already exists`);
      }
      return;
    }
    if (argv.config) {
      const configPath = path.resolve(argv.config);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        Object.assign(argv, config);
      } else {
        Logger.error(this.logTag, `${configPath} not exists`);
        return;
      }
    }
    if (argv.appDir) {
      await this.scanSingleProject(argv);
    } else {
      Logger.info(this.logTag, 'see --help');
    }
    Logger.info(this.logTag, `elapsed time ${Date.now() - startTime}`);
    if (argv.debug) {
      Logger.flush(this.getLogPath(argv));
    }
  }

  async scanSingleProject(argv: CommandArgs) {
    const collector = new ApiPermission(argv);
    await collector.setLibPath(this.findLibPath()).start();
  }

  async scanMultiProject(argv: CommandArgs) {
    if (!argv.sdk) {
      const collector = new MultiProjectApiPermission(argv);
      let includeTest = argv.scanTest || false;
      await collector.setLibPath(this.findLibPath()).setIncludeTest(includeTest).start();
    } else {
      Logger.error(this.logTag, '--appDir and --sdkRoot are used together, replace --sdk with --sdkRoot');
    }
  }

  async scanNonProject(argv: CommandArgs) {
    if (!argv.sdk) {
      Logger.error(this.logTag, 'the --sdk is required when scanning non-project');
      return;
    }
    const apiCollector = new ApiPermission(argv);
    await apiCollector.setLibPath(this.findLibPath()).start();
  }

  getLogPath(argv: CommandArgs): string {
    if (argv.output) {
      return argv.output;
    }
    if (argv.appDir) {
      return argv.appDir;
    }
    // if (argv.app) {
    //   return argv.app;
    // }
    return __dirname;
  }

  findLibPath(): string {
    if (process.env.bundleMode) {
      return path.resolve(__dirname, 'libs');
    }
    return path.resolve(__dirname, '..', 'libs');
  }

  stop() {
    Logger.info(this.logTag, 'stop');
  }

  checkArguments(argv: CommandArgs): boolean {
    if (argv.sdk) {
      const apiPath = path.resolve(argv.sdk, 'api');
      const componentPath = path.resolve(argv.sdk, 'component');
      if (!fs.existsSync(apiPath) || !fs.existsSync(componentPath)) {
        Logger.error(this.logTag, '--sdk option need to specify the ets directory');
        return false;
      }
    }
    return this.checkPathIsValid(argv.appDir) &&
      this.checkPathIsValid(argv.output) &&
      this.checkPathIsValid(argv.config) &&
      this.checkPathIsValid(argv.createConfig);
  }

  checkPathIsValid(pathStr: string | undefined): boolean {
    if (pathStr && !fs.existsSync(pathStr)) {
      Logger.error(this.logTag, `${pathStr} not exists`);
      return false;
    }
    return true;
  }
}
