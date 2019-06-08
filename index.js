// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on(['check_suite.requested', 'check_run.rerequested'], check)
  //app.on(['check_suite.requested'], check)

  async function check (context) {
    const startTime = new Date()

    // get the .prlint file
      // return a failed test if the file can't be gotten or is invalid
    // construct the PR object
    // run each check
      // report each check that fails
      // if no check failed report all checks passed
    // consider giving users the power to specify the shape of the PR object

    console.log(context.payload.check_run)

    // Do stuff
    const { head_branch: headBranch, head_sha: headSha } = context.payload.check_suite
    // Probot API note: context.repo() => {username: 'hiimbex', repo: 'testing-things'}
    context.github.checks.create(context.repo({
      name: 'Awesome',
      head_branch: headBranch,
      head_sha: headSha,
      status: 'queued',
      started_at: startTime,
      conclusion: 'success',
      completed_at: new Date(),
      output: {
        title: 'Checking PR!',
        summary: 'The check has running!'
      }
    }))
    setTimeout(() => {
      return context.github.checks.create(context.repo({
        name: 'PRLint Server',
        head_branch: headBranch,
        head_sha: headSha,
        status: 'completed',
        started_at: startTime,
        conclusion: 'success',
        completed_at: new Date(),
        output: {
          title: 'PR is convention-compliant!',
          summary: 'The check has passed!'
        }
      }))
    }, 30000)
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
