module.exports = async function ({ dir, github, context, glob, exec }) {
  const globber = await glob.create(`${dir}/env/*.backend.tfvars`)
  const files = await globber.glob()

  let output = ''
  let success = true

  for (const file of files) {
    const [ , env ] = file.match(/([^\/]+)\.backend.tfvars/)

    await exec.exec(
    `terraform init -reconfigure -backend-config env/${env}.backend.tfvars`,
      [],
      { cwd: dir }
    )
    const plan = await exec.getExecOutput(
      `terraform plan -no-color -var-file env/${env}.tfvars`,
      [],
      { cwd: dir }
    )
    if (plan.exitCode !== 0) success = false

    output += `<details><summary>Show Plan for ${env} ${plan.exitCode === 0 ? '🟢' : '🔴'}</summary>

\`\`\`terraform
${plan.stdout.split('\n').filter(v => !v.startsWith('::')).join('\n')}
\`\`\`
</details>\n\n`;
  }

  const comment = (await github.paginate(github.rest.issues.listComments, {
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
  })).find(comment => comment.user.login === 'github-actions[bot]' && comment.body.includes('Show Plan'))

  const commentPayload = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: output
  }

  if (comment) {
    await github.rest.issues.updateComment({
      ...commentPayload,
      comment_id: comment.id,
    })
  } else {
    await github.rest.issues.createComment({
      ...commentPayload,
      issue_number: context.issue.number,
    })
  }

  process.exit(success ? 0 : 1)
}
