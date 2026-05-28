import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const outputDir = join(projectRoot, 'output');
const outputDistDir = join(outputDir, 'dist');
const goBuildCacheDir = join(tmpdir(), 'liteflashchat-go-build-cache');
const executableName = process.platform === 'win32' ? 'liteflashchat.exe' : 'liteflashchat';
const outputExecutable = join(outputDir, executableName);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      GOCACHE: process.env.GOCACHE || goBuildCacheDir,
    },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 실패`);
  }
}

function npmCommandName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function removeIfExists(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

function copyFrontendDist() {
  removeIfExists(outputDistDir);
  cpSync(join(projectRoot, 'dist'), outputDistDir, { recursive: true });
}

function assertOutput() {
  if (!existsSync(outputExecutable) || !statSync(outputExecutable).isFile()) {
    throw new Error(`실행 파일 생성 실패: ${outputExecutable}`);
  }
  if (!existsSync(join(outputDistDir, 'index.html'))) {
    throw new Error(`정적 파일 복사 실패: ${outputDistDir}`);
  }
}

mkdirSync(outputDir, { recursive: true });
removeIfExists(outputExecutable);

console.log('[LiteFlashChat] 프론트엔드 빌드 시작');
run(npmCommandName('npm'), ['run', 'build']);

console.log('[LiteFlashChat] Go 백엔드 빌드 시작');
run('go', ['build', '-buildvcs=false', '-o', outputExecutable, '.']);

console.log('[LiteFlashChat] output/dist 복사 시작');
copyFrontendDist();

assertOutput();

console.log(`[LiteFlashChat] 빌드 완료: ${outputDir}`);
console.log(`[LiteFlashChat] 실행 파일: ${outputExecutable}`);
