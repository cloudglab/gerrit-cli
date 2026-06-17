export function renderBanner(): string {
  return [
    '   ___       ___       ___       ___       ___       ___   ',
    '  /\\  \\     /\\  \\     /\\  \\     /\\  \\     /\\  \\     /\\  \\  ',
    ' /::\\  \\   /::\\  \\   /::\\  \\   /::\\  \\   _\\:\\  \\    \\:\\  \\ ',
    '/:/\\:\\__\\ /::\\:\\__\\ /::\\:\\__\\ /::\\:\\__\\ /\\/::\\__\\   /::\\__\\',
    '\\:\\:\\/__/ \\:\\:\\/  / \\;:::/  / \\;:::/  / \\::/\\/__/  /:/\\/__/',
    ' \\::/  /   \\: /  /    |:\\/__/   |:\\/__/   \\:\\__\\    \\/__/   ',
    '  \\/__/     \\/__/     \\|__|     \\|__|     \\/__/             ',
  ].join('\n')
}

export function renderQuickStartGuide(): string {
  return `快速开始：
  gerrit help                          查看帮助
  gerrit mine                          查看我的变更
  gerrit incoming                      查看待审查列表
  gerrit show <change-id>              查看变更详情
  gerrit-reviewer diff <change-id>     走 reviewer 入口看 diff

常用配置：
  gerrit config show                   查看当前配置
  gerrit-ci build-status <change-id>   查看构建状态
  pnpm run release:smoke-query         发布前 dry-run smoke

写操作提示：评论、投票、submit、abandon、restore、push 都需要显式命令触发。`
}

export function renderInstallSuccessGuide(action: '安装' | '更新', status: string): string {
  return `${action}完成，${status}\n\n${renderBanner()}\n\n${renderQuickStartGuide()}`
}
