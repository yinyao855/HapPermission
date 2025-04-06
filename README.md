# ArkPermission

## Introduction
ArkPermission is a permission analysis tool based on ArkAnalyzer. It aims to assist developers and reviewers in quickly 
analyzing the permission usage of HarmonyOS applications and detecting whether an application abuses permissions.

## Usage
Execute `npm install` in the project folder to install the dependencies. You also need to modify the content of the 
`arkpermission_config.json` file. Then, use it through the following command:
```shell
npx ts-node ./src/entry/main.ts --app [app_path] --sdk [sdk_path] --output [output_path] --format excel
```
**Example**
```shell
npx ts-node ./src/entry/main.ts --app /Users/yaoyin/DevEcoStudioProjects/FormHost --sdk /Users/yaoyin/Library/OpenHarmony/Sdk/14/ets --output . --format excel
```