import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const sourceRoot = new URL('.', import.meta.url)

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

test('frontend source uses the review-friendly folder structure and jsx extension', () => {
  const requiredFiles = [
    'app/App.jsx',
    'components/layout/Sidebar.jsx',
    'components/common/WorkspaceUi.jsx',
    'pages/OverviewPages.jsx',
    'pages/ProjectPages.jsx',
    'pages/OrganizationPages.jsx',
    'pages/ActivityPages.jsx',
    'pages/TaskDetailsPage.jsx',
    'pages/ProfilePage.jsx',
    'modals/WorkspaceModals.jsx',
    'services/authApi.jsx',
    'services/taskApi.jsx',
    'utils/taskLogic.jsx',
    'styles/App.css',
  ]

  for (const relativePath of requiredFiles) {
    assert.equal(existsSync(new URL(relativePath, sourceRoot)), true, `${relativePath} should exist`)
  }

  const sourceFiles = collectFiles(fileURLToPath(sourceRoot))
  const legacyJavaScript = sourceFiles.filter((path) => /\.js$/.test(path))
  assert.deepEqual(legacyJavaScript, [], 'src should not contain .js files')

  const appSource = readFileSync(new URL('app/App.jsx', sourceRoot), 'utf8')
  assert.ok(appSource.split(/\r?\n/).length < 3200, 'App.jsx should only contain application orchestration')
})
