import util from 'node:util'
import { writeSync } from 'node:fs'
import childProcess, { spawn } from 'node:child_process'
import { Command, Option } from 'commander'
import { select } from '@inquirer/prompts'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { fromIni } from '@aws-sdk/credential-providers'

const exec = util.promisify(childProcess.exec)

export const login = new Command('login')
  .description(
    "Login to AWS with the given profile and sets AWS_PROFILE or AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, and AWS_CREDENTIAL_EXPIRATION. (Doesn't log in again if already logged in.)"
  )
  .option('-p, --profile <string>', 'the aws profile to log in with (~/.aws/config)')
  .addOption(
    new Option('-e, --export <string>', 'which environment variables to export.')
      .choices(['profile', 'creds', 'none'])
      .default('profile')
  )
  .action(async (args) => {
    let { profile } = args

    if (!profile) {
      const { stdout } = await exec('aws configure list-profiles')
      const profiles = stdout.trim().split('\n')

      profile = await select({
        message: 'Select a profile',
        choices: profiles.map((profile) => ({
          name: profile,
          value: profile
        }))
      })
    }

    try {
      const { stdout: region } = await exec(`aws configure get region --profile ${profile}`)

      const stsClient = new STSClient({
        region: region.trim(),
        credentials: fromIni({ profile })
      })

      await stsClient.send(new GetCallerIdentityCommand({}))
    } catch (error) {
      try {
        const awsLogin = spawn('aws', ['sso', 'login', '--profile', profile])
        awsLogin.stdout.on('data', (data) => {
          console.log(data.toString())
        })
        awsLogin.stderr.on('data', (data) => {
          console.log(data.toString())
        })
      } catch ({ stdout, stderr }) {
        console.log(stderr)
        return
      }
    }

    if (args.export === 'profile') {
      writeSync(3, 'unset AWS_ACCESS_KEY_ID\n')
      writeSync(3, 'unset AWS_SECRET_ACCESS_KEY\n')
      writeSync(3, 'unset AWS_SESSION_TOKEN\n')
      writeSync(3, 'unset AWS_CREDENTIAL_EXPIRATION\n')
      writeSync(3, `export AWS_PROFILE=${profile}\n`)
    } else if (args.export === 'creds') {
      writeSync(3, 'unset AWS_PROFILE\n')
      const { stdout } = await exec(
        `aws configure export-credentials --profile ${profile} --format env`
      )
      writeSync(3, stdout)
    } else {
      writeSync(3, 'unset AWS_PROFILE\n')
      writeSync(3, 'unset AWS_ACCESS_KEY_ID\n')
      writeSync(3, 'unset AWS_SECRET_ACCESS_KEY\n')
      writeSync(3, 'unset AWS_SESSION_TOKEN\n')
      writeSync(3, 'unset AWS_CREDENTIAL_EXPIRATION\n')
    }
  })
