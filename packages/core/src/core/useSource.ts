import fs from "fs-extra";
import { resolve } from "pathe";
import { useCurrentContext } from "./processor";
import type { MaybePromise } from "../types";

export interface SourceInfo extends Omit<UseSourceOptions, "folders"> {
    kind: number;
    folders: string[];
    patterns: string[];
    filter: (path: string) => boolean;
    output: (path: string, data: any) => Promise<void>;
}

interface UseSourceOptions<T = any> {
    base: string;
    dist?: string;
    folders?: string[];
    ext: string;
    deep?: boolean;
    skip?: number;
    parse: (path: string, info: SourceInfo) => MaybePromise<T | null | void>;
    unlink?: (cache: T) => void;
    onCacheHit?: (cache: T) => void;
}

export function useSource<C extends object>(kind: number, options: UseSourceOptions<C>) {
    const ctx = useCurrentContext();

    const base = resolve(options.base);
    const dist = options.dist ? resolve(options.dist) : void 0;
    const folders = options.folders?.map((folder) => resolve(base, folder)) ?? [base];
    const patterns = folders.map((path) => resolve(path, `**/*${options.ext}`));

    const info: SourceInfo = {
        ...options,
        kind,
        base,
        dist,
        folders,
        patterns,
        deep: options.deep ?? true,
        skip: options.skip ?? 0,
        filter(path) {
            const depth = path.split("/").length - folders[0].split("/").length;
            return info.skip! < depth;
        },
        async output(path, data) {
            const outPath = path.replace(base, dist!).replace(info.ext, ".json");
            await fs.outputJson(outPath, data);
        }
    };
    ctx.sourceInfos.push(info);

    return info;
}