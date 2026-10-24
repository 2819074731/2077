#!/usr/bin/env bash
# 无感发布：在临时目录构建，完成后原子切换产物，PM2 cluster 平滑重载。
# 线上进程始终持有自己的物理产物路径，构建和切换期间不影响在线请求。
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/my2077.com}"
RELEASE_ROOT="${RELEASE_ROOT:-/www/wwwroot/releases}"
NODE_BIN="${NODE_BIN:-/www/server/nodejs/v24.22.1/bin}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3100/}"
PREFLIGHT_PORT="${PREFLIGHT_PORT:-$((3200 + RANDOM % 500))}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

export PATH="$NODE_BIN:$PATH"
export npm_config_verify_deps_before_run=false
cd "$APP_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASE_ROOT/$TS"
RELEASE_OUT="$RELEASE_DIR/output"
STAGE="/tmp/my2077-build-$TS"
mkdir -p "$RELEASE_DIR" "$STAGE"

PREV=""
if [ -L .output ]; then
  PREV="$(readlink -f .output || true)"
fi

rollback() {
  cd "$APP_DIR"
  echo "[release] 发布失败，开始回滚"
  if [ -n "$PREV" ] && [ -f "$PREV/server/index.mjs" ]; then
    ln -sfn "$PREV" .output
    pm2 startOrReload ecosystem.config.cjs --update-env || true
    echo "[release] 已回滚到 $PREV"
  else
    echo "[release] 没有可回滚的上一版本"
  fi
  exit 1
}

echo "[release] 目标版本 $TS"

if [ "$SKIP_INSTALL" != "1" ]; then
  echo "[release] 安装依赖"
  pnpm install --frozen-lockfile --config.confirmModulesPurge=false
fi

echo "[release] 复制源码到临时构建目录"
tar -cf - \
  --exclude=./node_modules --exclude=./.output --exclude=./.output.link \
  --exclude='./.output.previous.*' --exclude=./.git --exclude=./.nuxt \
  --exclude=./data --exclude=./.env . \
  | tar -xf - -C "$STAGE"
ln -s "$APP_DIR/node_modules" "$STAGE/node_modules"
if [ -f "$APP_DIR/.env" ]; then ln -s "$APP_DIR/.env" "$STAGE/.env"; fi

echo "[release] 构建"
cd "$STAGE"
pnpm --config.verify-deps-before-run=false build

if [ ! -f "$STAGE/.output/server/index.mjs" ]; then
  echo "[release] 构建产物缺失"
  rollback
fi

mv "$STAGE/.output" "$RELEASE_OUT"

echo "[release] 预检新版本"
PREFLIGHT_LOG="/tmp/my2077-preflight-$TS.log"
PREFLIGHT_PID=""
cleanup_preflight() {
  if [ -n "$PREFLIGHT_PID" ] && kill -0 "$PREFLIGHT_PID" 2>/dev/null; then
    kill "$PREFLIGHT_PID" 2>/dev/null || true
    wait "$PREFLIGHT_PID" 2>/dev/null || true
  fi
}
ENV_ARGS=()
if [ -f "$APP_DIR/.env" ]; then ENV_ARGS=(--env-file="$APP_DIR/.env"); fi
(
  cd "$RELEASE_OUT"
  PORT="$PREFLIGHT_PORT" NITRO_PORT="$PREFLIGHT_PORT" HOST=127.0.0.1 NITRO_HOST=127.0.0.1 \
    node "${ENV_ARGS[@]}" server/index.mjs >"$PREFLIGHT_LOG" 2>&1 &
  echo $! >"/tmp/my2077-preflight-$TS.pid"
)
PREFLIGHT_PID="$(cat "/tmp/my2077-preflight-$TS.pid")"
trap cleanup_preflight EXIT
PREFLIGHT_OK=0
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PREFLIGHT_PORT/"; then
    PREFLIGHT_OK=1
    break
  fi
  sleep 1
done
cleanup_preflight
trap - EXIT
if [ "$PREFLIGHT_OK" != "1" ]; then
  echo "[release] 新版本预检失败，线上版本保持不变"
  tail -20 "$PREFLIGHT_LOG" || true
  exit 1
fi

cd "$APP_DIR"
# 旧进程已各自持有物理路径，移动入口链接不影响它们继续服务。
if [ -L .output ]; then
  mv -f .output .output.link
elif [ -d .output ]; then
  mv .output ".output.previous.$TS"
fi
ln -sfn "$RELEASE_OUT" .output

echo "[release] 平滑重载 PM2"
pm2 startOrReload ecosystem.config.cjs --update-env || rollback

for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 2 "$HEALTH_URL"; then
    echo "[release] 发布完成：$RELEASE_OUT（上一版本：${PREV:-无}）"
    exit 0
  fi
  sleep 1
done

echo "[release] 健康检查未通过"
rollback
