import {ApiDeclarationInformation} from "./api_recognizer";
import {Logger} from "./utils";
import path, {join} from "path";
import fs from "fs";
import csv from "csv-parser";

export class PermissionInfo {
    name: string;
    type: string;
    usedCount: number;

    constructor(name: string, type: string, usedCount: number) {
        this.name = name;
        this.type = type;
        this.usedCount = usedCount;
    }
}

/**
 * 权限API分析器
 */
export class ApiAnalyzer {
    apiInfos: ApiDeclarationInformation[];
    apiPermissionMap: Map<string, string>;
    sdkVersion: string = "14";
    permissionApiInfo: ApiDeclarationInformation[];
    permissionInfo: PermissionInfo[] = [];

    constructor(apiInfos: ApiDeclarationInformation[], sdkVersion: string) {
        this.apiInfos = apiInfos;
        this.apiPermissionMap = new Map<string, string>();
        this.sdkVersion = sdkVersion;
        this.permissionApiInfo = [];
        this.permissionInfo = [];
    }

    setSdkVersion(sdkVersion: string) {
        this.sdkVersion = sdkVersion;
    }

    initApiPermissionMap(): Promise<void> {
        this.apiPermissionMap.clear()
        const filePath = join(__dirname, `./assets/PerAPI/${this.sdkVersion}.csv`);

        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    const qualifiedName = `[${row['模块名']},${row['类名']},${row['方法名']},${row['函数']}]`;
                    const permission = row['权限'];
                    this.apiPermissionMap.set(qualifiedName, permission);
                })
                .on('end', () => {
                    Logger.info('ApiAnalyzer', `find ${this.apiPermissionMap.size} permission apis in CSV file`);
                    resolve();
                })
                .on('error', (error) => {
                    Logger.error('ApiAnalyzer', `Error reading CSV file: ${error}`);
                    reject(error);
                });
        });
    }

    async analyze() {
        await this.initApiPermissionMap()
        this.permissionApiInfo = [];
        for (const apiInfo of this.apiInfos) {
            const packageName = path.basename(apiInfo.packageName, '.d.ts').replace('@', '');
            const qualifiedName = `[${packageName},${apiInfo.typeName},${apiInfo.propertyName},${apiInfo.apiRawText}]`;
            const permission = this.apiPermissionMap.get(qualifiedName);
            if (permission) {
                apiInfo.apiPermission = permission;
                this.permissionApiInfo.push(apiInfo);
            }
        }
        Logger.info('ApiAnalyzer', 'end analyze used permission apis');
    }

    analyzePermissionAbuse(perDeclList: string[]) {
        // 统计项目中权限使用情况
        this.permissionInfo = [];
        const permissionCountMap = new Map<string, number>();
        for (const apiInfo of this.permissionApiInfo) {
            const perList = this.splitPermissions(apiInfo.apiPermission);
            for (const permission of perList) {
                const count = permissionCountMap.get(permission) || 0;
                permissionCountMap.set(permission, count + 1);
            }
        }

        const declaredPermissions = new Set(perDeclList);
        const usedPermissions = new Set(permissionCountMap.keys());

        // 正常使用的权限：声明且被使用
        const normallyUsedPermissions = new Set([...declaredPermissions].filter(perm => usedPermissions.has(perm)));
        // 未授权使用的权限：使用但未声明
        const unauthorizedPermissions = new Set([...usedPermissions].filter(perm => !declaredPermissions.has(perm)));
        // 声明后未使用的权限：声明但未使用
        const unusedDeclaredPermissions = new Set([...declaredPermissions].filter(perm => !usedPermissions.has(perm)));

        normallyUsedPermissions.forEach(perm => {
            this.permissionInfo.push(new PermissionInfo(perm, 'normal use', permissionCountMap.get(perm) || 0));
        });

        unauthorizedPermissions.forEach(perm => {
            this.permissionInfo.push(new PermissionInfo(perm, 'unauthorized use', permissionCountMap.get(perm) || 0));
        });

        unusedDeclaredPermissions.forEach(perm => {
            this.permissionInfo.push(new PermissionInfo(perm, 'declared but not used', 0));
        });
        Logger.info('ApiAnalyzer', `report summary: normal use, ${normallyUsedPermissions.size}; unauthorized use, ${unauthorizedPermissions.size}; declared but not used, ${unusedDeclaredPermissions.size}`);
        Logger.info('ApiAnalyzer', 'end analyze permission abuse');
    }

    splitPermissions(permissionStr: string): string[] {
        // 使用正则表达式匹配权限，忽略大小写的 or 和 and
        const regex = /\s*(?:or|and)\s*/i;
        return permissionStr.split(regex).map(permission => permission.trim());
    }

    getPermissionApiInfo() {
        return this.permissionApiInfo;
    }

    getPermissionInfo() {
        return this.permissionInfo;
    }
}