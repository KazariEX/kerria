import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { stat } from "node:fs/promises";
import chokidar from "chokidar";
import consola from "consola";
import * as pkg from "empathic/package";
import { join } from "pathe";
import { glob } from "tinyglobby";
import { capitalize, isDev, readJson, readJsonSync, writeJsonSync } from "../utils";
import type { LoadInfo } from "./useLoad";
import type { SourceInfo } from "./useSource";

interface Cache {
    hash: string;
}

interface KerriaContext {
    sign: string;
    loadInfos: LoadInfo[];
    sourceInfos: SourceInfo[];
}

let currentContext: KerriaContext | null = null;

export function useCurrentContext() {
    return currentContext!;
}

export function createKerria(sign: string, setup: (ctx: KerriaContext) => void) {
    const ctx: KerriaContext = {
        sign,
        loadInfos: [],
        sourceInfos: [],
    };

    currentContext = ctx;
    setup(ctx);
    currentContext = null;

    ctx.sourceInfos.sort((a, b) => {
        return a.kind - b.kind;
    });

    const cacheDir = pkg.cache("kerria", { create: true });
    const cachePath = join(cacheDir!, `${sign}.json`);
    const caches: Record<string, Cache> = existsSync(cachePath) && readJsonSync(cachePath) || {};

    async function build() {
        for (const info of ctx.sourceInfos) {
            const paths = await glob(info.patterns, {
                absolute: true,
            });

            await Promise.all(
                paths
                    .map((path) => path.replaceAll("\\", "/"))
                    .filter(info.filter)
                    .sort((a, b) => a.localeCompare(b))
                    .map((path) => parse(path, info)),
            );
        }
        outputLoads();
        consola.success(`[${sign}] Build`);
    }

    async function watch() {
        for (const info of ctx.sourceInfos) {
            chokidar.watch(info.folders, {
                depth: info.deep ? Infinity : 0,
                ignoreInitial: true,
            })
            .on("all", async (event: string, filename: string) => {
                const path = filename.replaceAll("\\", "/");

                if (!path.endsWith(info.ext)) {
                    return false;
                }
                else if (!info.filter(path)) {
                    return false;
                }
                else if (event === "change" && !await parse(path, info)) {
                    return false;
                }
                else if (event === "add" && !await add(path, info)) {
                    return false;
                }
                else if (event === "unlink" && !unlink(path, info)) {
                    return false;
                }
                outputLoads();
                consola.success(`[${sign}] ${capitalize(event)} "${path}"`);
            });
        }

        for (const info of ctx.loadInfos) {
            if (!info.src) {
                continue;
            }

            chokidar.watch(info.src, {
                ignoreInitial: true,
            })
            .on("change", async () => {
                const newVal = await readJson(info.src!);
                info.value = info.onUpdate?.(newVal, info.value) ?? newVal;
                info.output();
                consola.success(`[${sign}] Change "${info.src}"`);
            });
        }
    }

    async function parse(path: string, info: SourceInfo) {
        const stats = await stat(path);
        const hash = createHash("md5").update(stats.mtimeMs.toString()).digest("hex");

        let cache = caches[path];

        // 当在开发环境下命中缓存时
        if (isDev && cache?.hash === hash) {
            info.onCacheHit?.(cache);
            return false;
        }

        // 开始解析
        const data = await info.parse(path, info);

        if (data !== null) {
            // 重置缓存
            cache = {
                hash,
                ...data,
            };
            // 执行一次命中缓存的逻辑
            info.onCacheHit?.(cache);
            caches[path] = cache;
        }
        else {
            // 显式返回空值时清理数据
            unlink(path, info);
        }
        return true;
    }

    async function add(path: string, info: SourceInfo) {
        const cache = caches[path];

        // 缓存存在时无需更新
        if (cache) {
            return false;
        }

        // 开始解析
        return await parse(path, info);
    }

    function unlink(path: string, info: SourceInfo) {
        const cache = caches[path];

        // 缓存不存在时无需更新
        if (!cache) {
            return false;
        }

        // 执行自定义清理逻辑
        info.unlink?.(cache);

        // 清空缓存
        delete caches[path];
        return true;
    }

    function outputLoads() {
        if (isDev) {
            // 在开发环境下写入缓存
            writeJsonSync(cachePath, caches);
        }
        else {
            // 在生产环境下删除缓存
            rmSync(cachePath, { force: true });
        }

        for (const info of ctx.loadInfos) {
            info.output();
        }
    }

    return {
        build,
        watch,
    };
}
