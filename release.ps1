<#
.SYNOPSIS
  dsh-work-progress 一键发布助手：填好元数据、建立本地仓库、生成市场条目。

.DESCRIPTION
  完成发布前所有**不需要网络**的步骤。凭据相关动作（npm login / git push）
  只打印命令，不代你执行。

.EXAMPLE
  .\release.ps1 -GitHubUser jjxjjjjiik-bot -AuthorName "你的名字"

.EXAMPLE
  # 已有远端时顺便推送
  .\release.ps1 -GitHubUser jjxjjjjiik-bot -AuthorName "你的名字" -Push
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$GitHubUser,
    [Parameter(Mandatory = $true)][string]$AuthorName,
    [string]$Email = "",
    [string]$RepoName = "dsh-work-progress",
    [switch]$Push
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if ($Email -eq "") { $Email = "$GitHubUser@users.noreply.github.com" }
$repoUrl = "https://github.com/$GitHubUser/$RepoName"
$utf8 = New-Object System.Text.UTF8Encoding($false)

# 原生命令（git）把提示与警告写进 stderr 是常态，不应被当成终止错误。
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }

Write-Host ""
Write-Host "=========================================="
Write-Host "  dsh-work-progress 发布助手"
Write-Host "=========================================="
Write-Host "  目录   : $root"
Write-Host "  GitHub : $GitHubUser"
Write-Host "  署名   : $AuthorName"
Write-Host "  邮箱   : $Email"
Write-Host ""

# ---- 1. package.json 元数据 ----------------------------------------------
$pkgPath = Join-Path $root "package.json"
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$pkg | Add-Member -NotePropertyName "repository" -NotePropertyValue ([pscustomobject]@{ type = "git"; url = "git+$repoUrl.git" }) -Force
$pkg | Add-Member -NotePropertyName "homepage"   -NotePropertyValue $repoUrl -Force
$pkg | Add-Member -NotePropertyName "bugs"       -NotePropertyValue ([pscustomobject]@{ url = "$repoUrl/issues" }) -Force
$pkg | Add-Member -NotePropertyName "author"     -NotePropertyValue $AuthorName -Force
[System.IO.File]::WriteAllText($pkgPath, ($pkg | ConvertTo-Json -Depth 20), $utf8)
Write-Host "[1/5] package.json 已写入 repository / homepage / bugs / author"

# ---- 2. LICENSE 署名 -------------------------------------------------------
$licPath = Join-Path $root "LICENSE"
$lic = Get-Content $licPath -Raw -Encoding UTF8
if ($lic -match 'Copyright \(c\) 2026\s+<.*>') {
    $lic = $lic -replace 'Copyright \(c\) 2026\s+<[^>]*>', "Copyright (c) 2026 $AuthorName"
    [System.IO.File]::WriteAllText($licPath, $lic, $utf8)
    Write-Host "[2/5] LICENSE 署名已替换为 $AuthorName"
} else {
    Write-Host "[2/5] LICENSE 署名已是具体名字，跳过"
}

# ---- 3. 文档里的占位符 -----------------------------------------------------
$replaced = 0
foreach ($f in @("README.md", "README.en.md", "PUBLISHING.md")) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) { continue }
    $t = Get-Content $p -Raw -Encoding UTF8
    $before = $t
    $t = $t -replace '<owner>', $GitHubUser
    $t = $t -replace '<你>', $GitHubUser
    if ($t -ne $before) {
        [System.IO.File]::WriteAllText($p, $t, $utf8)
        $replaced++
    }
}
Write-Host "[3/5] 文档占位符替换完成（$replaced 个文件）"

# ---- 4. 生成市场收录条目 ---------------------------------------------------
# 依据 awesome-dsh-plugin 的 contributing.md：投稿 = 新增一个 YAML 文件，
# 命名为 <owner>__<repo>.yml，而不是去改 README（README 由脚本生成）。
# 注意：不要写 npm / version / install 字段——这些由市场自动采集，
# 在 yml 里手写 npm: 会被校验直接拒绝。
$slug = "${GitHubUser}__dsh-work-progress"
$yml = @"
url: $repoUrl
name: $GitHubUser/dsh-work-progress
category: ui
description:
  en: "Persistent work-progress row above the composer: task completion, a progress bar, and what the agent is doing right now (generating a reply or running a tool), expandable into the full task list with turns, steps, timings and context usage."
  zh: "输入框上方常驻的工作进度行：任务完成度、进度条，以及此刻正在做什么（生成回复或执行工具）；展开可见完整任务清单与轮次、步骤、耗时、上下文占用。"
"@
$entryDir = Join-Path $root "_market-entry"
New-Item -ItemType Directory -Path $entryDir -Force | Out-Null
$entryPath = Join-Path $entryDir "$slug.yml"
[System.IO.File]::WriteAllText($entryPath, $yml, $utf8)
Write-Host "[4/5] 市场收录条目已生成 -> _market-entry/$slug.yml（category=ui）"

# ---- 5. 本地仓库 -----------------------------------------------------------
# git 会把 branch hint 与 LF→CRLF 警告写进 stderr；在 $ErrorActionPreference="Stop"
# 之下一律被当成终止错误，使脚本在提交之前中断。这里显式降级——命令本身没有失败
# 就不该终止脚本。（不依赖 $PSNativeCommandUseErrorActionPreference：它在部分
# PowerShell 版本与上下文中并不生效。）
$ErrorActionPreference = "Continue"
if (-not (Test-Path (Join-Path $root ".git"))) {
    git init -b main 2>$null | Out-Null
    Write-Host "[5/5] 已初始化 git 仓库（分支 main）"
} else {
    Write-Host "[5/5] git 仓库已存在，追加提交"
}

git add -A 2>$null
$staged = @(git diff --cached --name-only 2>$null).Count
if ($staged -gt 0) {
    git -c user.name="$AuthorName" -c user.email="$Email" commit -m "feat: dsh-work-progress v$($pkg.version) — dock progress row with live activity" 2>$null | Out-Null
    Write-Host "      已提交 $staged 个文件"
} else {
    Write-Host "      没有需要提交的改动"
}
git branch -M main 2>$null | Out-Null
$ErrorActionPreference = "Stop"

# ---- 后续步骤 --------------------------------------------------------------
Write-Host ""
Write-Host "================= 本地准备完成 ================="
Write-Host ""
Write-Host "接下来需要你自己执行（涉及凭据，脚本不代做）："
Write-Host ""
Write-Host "  1) 推送（GitHub 需可访问）"
Write-Host "     git remote add origin $repoUrl.git"
Write-Host "     git push -u origin main"
Write-Host ""
Write-Host "  2) 发布 npm"
Write-Host "     npm login"
Write-Host "     npm publish --access public"
Write-Host ""
Write-Host "  3) 提交市场收录（PR 新增一个 YAML 文件，不是改 README）"
Write-Host "     fork https://github.com/awesome-dsh-plugin/awesome-dsh-plugin"
Write-Host "     把 _market-entry/${GitHubUser}__dsh-work-progress.yml 放进该仓库的 data/plugins/"
Write-Host "     然后开 PR（前置条件：仓库创建满 1 天、已加 dsh-plugin topic）"
Write-Host ""

if ($Push) {
    Write-Host "尝试推送 ..."
    $remote = git remote get-url origin 2>$null
    if ($null -eq $remote) { git remote add origin "$repoUrl.git" }
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { Write-Host "[错误] 推送失败——检查 GitHub 是否可达。" -ForegroundColor Red }
}
