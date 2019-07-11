// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

var models = require('./database/models');
var utils = require('./utils');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  const router = app.route('/api');
  router.get('/stats', async (req, res) => {
    const installs = await models.Installation.count();
    const repos = await models.Repository.count();
    res.json({
      installs,
      repos
    });
  });

  app.on(['check_suite.requested', 'check_run.rerequested'], handleCheckEvents);
  app.on([
    'installation.created',
    'installation.deleted',
    'installation_repositories.added',
    'installation_repositories.removed'
  ],
  handleInstallationEvents);

  async function handleInstallationEvents(context) {
    try {
      const { payload } = context;
      if (context.name === 'installation') {
        if (payload.action === 'created') {
          const installation = await models.Installation.create({
            id: payload.installation.id,
            accessTokenUrl: payload.installation.access_tokens_url,
            accountName: payload.installation.account.login,
            accountType: payload.installation.account.type,
            accountUrl: payload.installation.account.url,
            targetId: payload.installation.target_id,
            targetType: payload.installation.target_type,
          });
          if (installation) {
            payload.repositories.forEach(async repo => {
              const repository = await models.Repository.create({
                id: repo.id,
                fullName: repo.full_name,
                installationId: installation.id,
                name: repo.name,
                private: repo.private,
              });
            });
          }
        } else if (payload.action === 'deleted') {
          // deleting the installation will cascade delete its repos
          await models.Installation.destroy({
            where: {
              id: payload.installation.id,
            }
          });
        }
      } else if (context.name === 'installation_repositories') {
        payload.repositories_added.forEach(async repo => {
          // just in case it already exists
          // (which will be the case if payload.installation.repository_selection
          // is changing from 'all' to 'selected')
          let repository = await models.Repository.destroy({
            where: {
              id: repo.id,
            }
          });
          repository = await models.Repository.create({
            id: repo.id,
            fullName: repo.full_name,
            installationId: payload.installation.id,
            name: repo.name,
            private: repo.private,
          });
        });
        payload.repositories_removed.forEach(async repo => {
          const repository = await models.Repository.destroy({
            where: {
              id: repo.id,
            }
          });
        });
      }
    } catch (e) {}
  }

  async function handleCheckEvents(context) {
    const startTime = new Date()

    // extract info
    const {
      check_run: checkRun,
      check_suite,
      repository
    }
    = context.payload;
    let checkSuite = check_suite || checkRun.check_suite;
    const {
      head_branch: headBranch,
      head_sha: headSha,
      pull_requests: pullRequests
    }
    = checkSuite;

    // get the .githint.json file
    const gitHintResponse = await checkGitHintFile(context, {
      checkRun,
      headBranch,
      headSha,
      repository,
      startTime
    });
    if (!gitHintResponse.data || !gitHintResponse.data.checks) {
      return;
    }
    const gitHintFile = gitHintResponse.data;
    const options = gitHintFile.options || {};

    // get the pull
    let pullResponse = {};
    pullResponse = await checkPull(context, {
      checkRun,
      headBranch,
      headSha,
      options,
      pull: pullRequests[0],
      repository,
      startTime
    });
    if (!pullResponse.data && options.detectPull) {
      return;
    }
    const pull = await getPullInnerObjects(context, {
      pull: pullResponse.data
    });

    // get the branch
    var getBranchResponse = await context.github.repos.getBranch({
      owner: repository.owner.login,
      repo: repository.name,
      branch: headBranch
    });
    const branch = { ...getBranchResponse.data };

    // get the commit
    var getCommitResponse = await context.github.repos.getCommit({
      owner: repository.owner.login,
      repo: repository.name,
      sha: headSha
    });
    const commit = { ...getCommitResponse.data };

    // get the tree
    var getTreeResponse = await context.github.gitdata.getTree({
      owner: repository.owner.login,
      repo: repository.name,
      tree_sha: commit.commit.tree.sha,
      recursive: 1
    });
    const tree = { ...getTreeResponse.data };

    // run checks
    const checkNames = await getChecksToPerform({
      checkRun: checkRun && checkRun.name === 'GitHint: check for pull request' ? undefined : checkRun,
      gitHintFile
    });
    if (checkNames.length > 0) {
      runChecks(context, {
        checkRun: checkRun && checkRun.name === 'GitHint: check for pull request' ? undefined : checkRun,
        checkNames,
        gitHintFile,
        headBranch,
        headSha,
        scope: {
          branch,
          commit,
          pull,
          tree
        },
        startTime
      });
    }
  }

  async function runChecks(context, {
    checkRun,
    checkNames,
    gitHintFile,
    headBranch,
    headSha,
    scope,
    startTime
  }) {
    let allChecksPassed = true;
    let skippedChecks = [];
    for (let i = 0; i < checkNames.length; i++) {
      const name = checkNames[i];
      let script = gitHintFile.checks[name];
      let message = '';
      // first, if script is an object get script from script.script
      if (typeof script === 'object' && !Array.isArray(script)) {
        if (script.skip === true) {
          skippedChecks.push(name);
          continue;
        }
        message = script.message || message;
        script = script.script || 'false';
        // if message is an array, join them
        if (Array.isArray(message)) {
          message = message.join("\n");
        }
      }
      // if script is an array, join them
      if (Array.isArray(script)) {
        script = script.filter(line => !!(line.trim())).join("\n");
      }
      // if script is string
      else if (typeof script === 'string') {
        script = `return ${script}`;
      }
      const response = await utils.runScript(script, scope);
      let resData = response.data;
      let resMessage;
      if (response.data && typeof response.data === 'object') {
        resData = response.data.result;
        resMessage = response.data.message;
      } else if (response.error) {
        resMessage = response.error.message;
      }
      allChecksPassed = allChecksPassed && resData;
      if (!resData || (checkRun && checkRun.name === name)) {
        postCheckResult(context, {
          name,
          conclusion: !resData ? 'failure' : 'success',
          headBranch,
          headSha,
          startTime,
          status: 'completed',
          summary:
            resMessage
            ? resMessage
            : `The check '${name}' ${resData === true ? 'passed' : 'failed'}.`,
          text: message,
          title: name
        });
      }
    }
    if (allChecksPassed && !checkRun) {
      const checksSkipped = skippedChecks.length;
      postCheckResult(context, {
        name: `All checks passed`,
        conclusion: 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: `All checks that were run passed.`,
        text:
          `${checksSkipped === 0 ? "No" : checksSkipped} check${checksSkipped < 2 ? " was" : "s were"} skipped.` +
          `${checksSkipped === 0 ? "" : "\n" + skippedChecks.map(c => `  * ${c}`).join("\n")}`,
        title: `All checks passed`
      });
    }
  }
  async function checkPull(context, {checkRun, headBranch, headSha, options, pull, repository, startTime}) {
    let response = {};
    if (pull) {
      response = await context.github.pullRequests.get({
        owner: repository.owner.login,
        repo: repository.name,
        number: pull.number
      });
    }
    const name = 'GitHint: check for pull request'; // if u change this here, change it somewhere above (Ctrl+F)
    if ((!response.data && options.detectPull) || (checkRun && checkRun.name === name)) {
      postCheckResult(context, {
        name,
        conclusion: !response.data ? 'failure' : 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary:
          response.error
          ? response.error.message
          : `The check '${name}' ${!response.data ? 'failed' : 'passed'}.`,
        text:
          !response.data
          ? 'If a code commit was made before a pull request was created ' +
          'then this check will fail. After a pull request is created you can ' +
          're-run this check. If it\'s still failing you may want to wait a ' +
          'few seconds before re-running it.'
          : 'The pull request has been detected successfully.',
        title: name
      });
    }
    return response;
  }
  async function checkGitHintFile(context, {checkRun, headBranch, headSha, repository, startTime}) {
    const response = await utils.getGitHintFile(repository.owner.login, repository.name, headBranch);
    const name = 'GitHint: check for .githint.json file';
    if (!response.data || (checkRun && checkRun.name === name)) {
      postCheckResult(context, {
        name,
        conclusion: !response.data ? 'failure' : 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: response.error ? response.error.message : `The check '${name}' passed.`,
        // text: "There's supposed to be a .githint.json file in the root directory",
        title: name
      });
    }
    return response;
  }

  async function getChecksToPerform({ checkRun, gitHintFile }) {
    if (gitHintFile.checks) {
      let checkNames = Object.keys(gitHintFile.checks);
      if (checkRun) {
        let checkNameToReRun = checkNames.find(name => name === checkRun.name);
        if (checkNameToReRun) {
          checkNames = [checkNameToReRun];
        } else {
          checkNames = [];
        }
      }
      return checkNames;
    }
    return [];
  }

  async function getPullInnerObjects(context, { pull }) {
    if (!pull) {
      return;
    }

    // get the reviews
    const reviewsResponse = await context.github.pullRequests.listReviews({
      owner: pull.head.repo.owner.login,
      repo: pull.head.repo.name,
      number: pull.number
    });
    pull.reviews = reviewsResponse.data;

    return pull;
  }

  async function postCheckResult (context, {
    conclusion,
    headBranch,
    headSha,
    name,
    startTime,
    status,
    summary,
    text,
    title
  }) {
    // Probot API note: context.repo() => {username: 'hiimbex', repo: 'testing-things'}
    context.github.checks.create(context.repo({
      name,
      head_branch: headBranch,
      head_sha: headSha,
      status,
      started_at: startTime,
      conclusion,
      completed_at: new Date(),
      output: {
        title,
        summary,
        text
      }
    }))
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
