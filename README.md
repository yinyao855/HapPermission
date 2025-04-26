# HapPermission

## Introduction
HapPermission is a permission analysis tool based on ArkAnalyzer. It aims to assist developers and reviewers in quickly analyzing the permission usage of HarmonyOS applications and detecting whether an application misuses permissions.

We also provide a [real application dataset](https://bhpan.buaa.edu.cn/link/AA7F552701EB7B419E855F0E1309C3978F) for testing and validating the functionality of HapPermission.
The format of the dataset is as follows. Each API version corresponds to a folder, and the folder contains all the applications of that version.
```
.
├── V10
├── V11
├── V12
├── V13
├── V14
└── V15
```

## Usage
Install it via `npm`, or download the dependency package and then use `npm install XXX.tgz` for installation.
```shell
npm install hap-permission
```
You can choose to install it globally using `npm install -g hap-permission`. In this way, you can directly use the `haper` command in the terminal.
HapPermission is a command-line tool. You can view the help information by using `--help`. It is recommended to use it with a configuration file.
```shell
npx haper --createConfig .
```
After executing this command, a `haper-config.json` file will be generated in the current directory. This file contains all the configuration items, with the following format.
```json5
{
  "appName": "",                  // Application name
  "appDir": "",                   // Application path
  "sdk": "sdk-root/version/ets",  // SDK path, the ets directory needs to be specified
  "output": "",                   // Report output path
  "format": "excel/csv/json",     // Report format, it is recommended to use the excel format
  "scanTest": false,              // Whether to include the test folder
  "debug": false,                 // Whether to enable debug mode
  "noRepeat": false               // Whether to remove duplicates
}
```
After completing the configuration, execute the following command for analysis.
```shell
npx haper --config haper-config.json
```

## Development
### Install dependencies
```shell
npm install
```

### Build
```shell
npm run build
```

### Package
```shell
npm run pack
```

### Deploy
```shell
npm install hap-permission-XXX.tgz
```