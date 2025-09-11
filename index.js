#!/usr/bin/env node

import util from 'node:util'
import childProcess, { spawn } from 'node:child_process'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { Command, Option } from 'commander'
import { fromIni } from '@aws-sdk/credential-providers'

const exec = util.promisify(childProcess.exec)
const program = new Command()

program.name('oz').description('awscli macros').version('1.0.0-alpha.1')

program
  .command('login')
  .description(
    "Login to AWS with the given profile and sets AWS_PROFILE or AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, and AWS_CREDENTIAL_EXPIRATION. (Doesn't log in again if already logged in.)"
  )
  .requiredOption('-p, --profile <string>', 'the aws profile to log in with (~/.aws/config)')
  .addOption(
    new Option('-e, --export <string>', 'which environment variables to export.')
      .choices(['profile', 'creds', 'none'])
      .default('profile')
  )
  .action(async (args) => {
    try {
      const { stdout: region } = await exec(`aws configure get region --profile ${args.profile}`)

      const stsClient = new STSClient({
        region: region.trim(),
        credentials: fromIni({ profile: args.profile })
      })

      await stsClient.send(new GetCallerIdentityCommand({}))
    } catch (error) {
      try {
        const awsLogin = spawn('aws', ['sso', 'login', '--profile', args.profile])
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
      console.log('unset AWS_ACCESS_KEY_ID')
      console.log('unset AWS_SECRET_ACCESS_KEY')
      console.log('unset AWS_SESSION_TOKEN')
      console.log('unset AWS_CREDENTIAL_EXPIRATION')
      console.log(`export AWS_PROFILE=${args.profile}`)
    } else if (args.export === 'creds') {
      console.log('unset AWS_PROFILE')
      const { stdout } = await exec(
        `aws configure export-credentials --profile ${args.profile} --format env`
      )
      console.log(stdout)
    } else {
      console.log('unset AWS_PROFILE')
      console.log('unset AWS_ACCESS_KEY_ID')
      console.log('unset AWS_SECRET_ACCESS_KEY')
      console.log('unset AWS_SESSION_TOKEN')
      console.log('unset AWS_CREDENTIAL_EXPIRATION')
    }
  })

const envCommand = program.command('env').description('Manage AWS environment variables.')

envCommand
  .command('print')
  .description('print the aws environment variables')
  .action(() => {
    console.log(`AWS_PROFILE=${process.env.AWS_PROFILE ?? ''}`)
    console.log(`AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID ?? ''}`)
    console.log(`AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY ?? ''}`)
    console.log(`AWS_SESSION_TOKEN=${process.env.AWS_SESSION_TOKEN ?? ''}`)
    console.log(`AWS_CREDENTIAL_EXPIRATION=${process.env.AWS_CREDENTIAL_EXPIRATION ?? ''}`)
  })

envCommand
  .command('clear')
  .description('clear the aws environment variables')
  .action(() => {
    console.log('unset AWS_PROFILE')
    console.log('unset AWS_ACCESS_KEY_ID')
    console.log('unset AWS_SECRET_ACCESS_KEY')
    console.log('unset AWS_SESSION_TOKEN')
    console.log('unset AWS_CREDENTIAL_EXPIRATION')
  })

program.parse()
