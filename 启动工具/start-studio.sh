#!/bin/zsh
set -eu

STUDIO_ROOT="/Users/xieyingjun/Documents/画室"
NODE="$STUDIO_ROOT/runtime/node"
NEXT="$STUDIO_ROOT/node_modules/next/dist/bin/next"
LOG_DIR="$STUDIO_ROOT/运行日志"

mkdir -p "$LOG_DIR"

if ! /usr/bin/curl -fsS http://localhost:3100/ >/dev/null 2>&1; then
  cd "$STUDIO_ROOT"
  /usr/bin/nohup "$NODE" "$NEXT" start -p 3100 \
    >>"$LOG_DIR/画室.log" 2>>"$LOG_DIR/画室错误.log" </dev/null &
  echo $! > "$LOG_DIR/画室.pid"
fi

for attempt in {1..40}; do
  if /usr/bin/curl -fsS http://localhost:3100/ >/dev/null 2>&1; then
    /usr/bin/open http://localhost:3100/
    exit 0
  fi
  /bin/sleep 0.25
done

/usr/bin/osascript -e 'display alert "画室启动失败" message "请查看画室文件夹中的“运行日志”文件夹。" as critical'
exit 1
