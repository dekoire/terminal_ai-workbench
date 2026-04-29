import { useAppStore } from '../store/useAppStore'

export async function updateDocsWithAI(projectPath: string) {
  const projectId = useAppStore.getState().projects.find(p => p.path === projectPath)?.id ?? projectPath
  useAppStore.getState().setDocApplying(projectId, true)
  try {
    const { docTemplates, aiProviders, aiFunctionMap } = useAppStore.getState()
    const enabled = docTemplates.filter(t => t.enabled)
    const docProvId = aiFunctionMap['docUpdate']
    const provider = aiProviders.find(p => p.id === docProvId)
      ?? aiProviders.find(p => p.name === 'Initial Docu Check')
      ?? aiProviders.find(p => p.name === 'Docu Update')

    for (const tpl of enabled) {
      const fullPath = `${projectPath}/${tpl.relativePath}`
      const checkRes = await fetch(`/api/file-read?path=${encodeURIComponent(fullPath)}`)
      const checkData = await checkRes.json() as { ok: boolean; content?: string }

      if (!checkData.ok || !checkData.content) {
        await fetch('/api/file-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullPath, content: tpl.content }),
        })
      } else if (provider) {
        const refineRes = await fetch('/api/ai-refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: provider.provider,
            apiKey: provider.apiKey,
            model: provider.model,
            text: checkData.content,
            systemPrompt: `You are updating a project documentation file. The documentation template for "${tpl.name}" is:\n\n${tpl.content}\n\nReview the existing file content and update it to better match the template structure. Preserve all project-specific information already present. Only improve structure and fill obvious gaps from the template. Return only the updated file content without any explanation.`,
          }),
        })
        const refineData = await refineRes.json() as { ok: boolean; text?: string }
        if (refineData.ok && refineData.text) {
          await fetch('/api/file-write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, content: refineData.text }),
          })
        }
      }
    }
  } finally {
    useAppStore.getState().setDocApplying(projectId, false)
  }
}
