#!/usr/bin/env node

import util from 'node:util'
import childProcess, { spawn } from 'node:child_process'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { Command } from 'commander'
import { fromIni } from '@aws-sdk/credential-providers'

const exec = util.promisify(childProcess.exec)
const program = new Command()

program.name('oz').description('awscli macros').version('1.0.0-alpha.1')

program
  .command('login')
  .description(
    "Login to AWS with the given profile and sets AWS_PROFILE. (Doesn't log in again if already logged in.)"
  )
  .requiredOption('-p, --profile <string>', 'the aws profile to log in with (~/.aws/config)')
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
    console.log(`export AWS_PROFILE=${args.profile}`)
  })

program.parse()
