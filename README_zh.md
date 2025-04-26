# HapPermission

## 介绍
HapPermission 是一个基于 ArkAnalyzer 的权限分析工具，旨在帮助开发者和审核人员快速分析鸿蒙应用的权限使用情况，并检测应用是否滥用权限。

我们还提供了一个[真实应用数据集](https://bhpan.buaa.edu.cn/link/AA7F552701EB7B419E855F0E1309C3978F)，用于测试和验证 HapPermission 的功能。
数据集格式如下, 每个 API 版本对应一个文件夹，文件夹中包含了该版本的所有应用。
```
.
├── V10
├── V11
├── V12
├── V13
├── V14
└── V15
```

## 使用
通过`npm`安装，或者下载依赖包后使用`npm install XXX.tgz`安装
```shell
npm install hap-permission
```
你可以选择`npm install -g hap-permission`全局安装，这样可以在终端直接使用`haper`命令。
HapPermission 是一个命令行工具，可通过`--help`查看帮助信息，推荐配置文件方式使用
```shell
npx haper --createConfig .
```
执行该命令后会在当前目录下生成一个`haper-config.json`文件，该文件中包含了所有的配置项，格式如下。
```json5
{
  "appName": "",                  // 应用名称
  "appDir": "",                   // 应用路径
  "sdk": "sdk-root/version/ets",  // SDK路径，需要指定ets目录
  "output": "",                   // 报告输出路径
  "format": "excel/csv/json",     // 报告格式，建议使用excel格式
  "scanTest": false,              // 是否包含测试文件夹
  "debug": false,                 // 是否开启调试模式
  "noRepeat": false               // 是否去重
}
```
配置完成后，执行以下命令进行分析
```shell
npx haper --config haper-config.json
```

## 开发
### 安装依赖
```shell
npm install
```

### 构建
```shell
npm run build
```

### 打包
```shell
npm run pack
```

### 部署
```shell
npm install hap-permission-XXX.tgz
```