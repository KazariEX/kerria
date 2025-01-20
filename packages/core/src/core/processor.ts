import chokidar from "chokidar";
import consola from "consola";
import CryptoES from "crypto-es";
import findCacheDir from "find-cache-dir";
import fs from "fs-extra";
import { join } from "pathe";
import { glob } from "tinyglobby";
import { capitalize, isDev } from "../utils";
import type { LoadInfo } from "./useLoad";
import type { SourceInfo } from "./useSource";

interface Cache {
    hash: string;
}

interface ProcessorContext {
    sign: string;
    loadInfos: LoadInfo[];
    sourceInfos: SourceInfo[];
}

let currentContext: ProcessorContext | null = null;

export function useCurrentContext() {
    return currentContext!;
}

export function createProcessor(sign: string, setup: (ctx: ProcessorContext) => void) {
    const ctx: ProcessorContext = {
        sign,
        loadInfos: [],
        sourceInfos: []
    };

    currentContext = ctx;
    setup(ctx);
    currentContext = null;

    ctx.sourceInfos.sort((a, b) => {
        return a.kind - b.kind;
    });

    const cacheDir = findCacheDir({ name: "kerria" });
    const cachePath = join(cacheDir!, `${sign}.json`);
    const caches: Record<string, Cache> = fs.existsSync(cachePath) && fs.readJsonSync(cachePath) || {};

    async function build() {
        for (const info of ctx.sourceInfos) {
            const paths = await glob(info.patterns, {
                deep: info.deep ? Infinity : 2,
                absolute: true
            });

            await Promise.all(
                paths
                    .map((path) => path.replaceAll("\\", "/"))
                    .filter(info.filter)
                    .sort((a, b) => a.localeCompare(b))
                    .map((path) => parse(path, info))
            );
        }
        outputLoads();
        consola.success(`[${sign}] Build`);
    }

    async function watch() {
        for (const info of ctx.sourceInfos) {
            chokidar.watch(info.folders, {
                depth: info.deep ? Infinity : 0,
                ignoreInitial: true
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
                ignoreInitial: true
            })
            .on("change", async () => {
                const newVal = await fs.readJson(info.src!);
                info.value = info.onUpdate(newVal, info.value);
                info.output();
                consola.success(`[${sign}] Change "${info.src}"`);
            });
        }
    }

    async function parse(path: string, info: SourceInfo) {
        const stats = await fs.stat(path);
        const hash = CryptoES.MD5(stats.size.toString()).toString();

        let cache = caches[path];

        // 当在开发环境下命中缓存时
        if (isDev && cache?.hash === hash) {
            info.onCacheHit?.(cache);
            return false;
        }

        // 重置缓存
        cache = { hash };

        // 开始解析
        const data = await info.parse(path, info);

        if (data !== null) {
            cache = {
                ...cache,
                ...data ?? {}
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
        fs.outputJsonSync(cachePath, caches);

        for (const info of ctx.loadInfos) {
            info.output();
        }
    }

    return {
        build,
        watch
    };
}