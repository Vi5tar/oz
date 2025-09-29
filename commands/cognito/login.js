import util from 'node:util'
import childProcess from 'node:child_process'
import { Command } from 'commander'
import { select, input } from '@inquirer/prompts'

const exec = util.promisify(childProcess.exec)

export const login = new Command('login')
  .description('login to a cognito user pool')
  .action(async () => {
    const selectedPool = await _getPaginatedSelection(
      'aws cognito-idp list-user-pools --max-results 10',
      'UserPools',
      'Name',
      'Id'
    )

    console.log(`Selected pool ID: ${selectedPool}`)

    const selectedClient = await _getPaginatedSelection(
      `aws cognito-idp list-user-pool-clients --user-pool-id ${selectedPool}`,
      'UserPoolClients',
      'ClientName',
      'ClientId'
    )

    console.log(`Selected client ID: ${selectedClient}`)

    const authFlow = await select({
      message: 'Select an authentication flow',
      choices: [
        {
          name: 'CUSTOM_AUTH',
          value: 'CUSTOM_AUTH'
        }
      ]
    })

    console.log(`Selected auth flow: ${authFlow}`)

    const { stdout: defaultUserName } = await exec('git config user.email', {
      env: { ...process.env }
    })

    const userName = await input({
      message: 'Enter a username',
      default: defaultUserName.trim()
    })

    console.log(`Selected username: ${userName}`)

    try {
      console.log('Initiating authentication...')

      const authCommand = `aws cognito-idp admin-initiate-auth --user-pool-id ${selectedPool} --client-id ${selectedClient} --auth-flow ${authFlow} --auth-parameters USERNAME=${userName}`

      let authResult
      try {
        const { stdout } = await exec(authCommand, {
          env: { ...process.env }
        })
        authResult = JSON.parse(stdout)
      } catch (error) {
        if (error.stderr && error.stderr.includes('UserNotFoundException')) {
          console.log('User not found.')

          const createUser = await input({
            message: 'Create user? (y/n)',
            default: 'y',
            validate(input) {
              return input === 'y' || input === 'n'
            }
          })

          if (createUser === 'y') {
            const { stdout: passwordOutput } = await exec(
              'aws secretsmanager get-random-password --password-length 16 --require-each-included-type --output text --query RandomPassword',
              { env: { ...process.env } }
            )
            const randomPassword = passwordOutput.trim().replace(/'/g, "'\"'\"'")

            await exec(
              `aws cognito-idp sign-up --client-id ${selectedClient} --username ${userName} --user-attributes Name=email,Value=${userName} --password '${randomPassword}'`,
              { env: { ...process.env } }
            )

            const { stdout } = await exec(authCommand, {
              env: { ...process.env }
            })
            authResult = JSON.parse(stdout)
          } else {
            process.exit(0)
          }
        } else {
          throw error
        }
      }

      const authCode = await input({
        message: 'Enter verification code:'
      })

      const challengeCommand = `aws cognito-idp respond-to-auth-challenge --client-id ${selectedClient} --challenge-name ${authResult.ChallengeName} --session ${authResult.Session} --challenge-responses USERNAME="${authResult.ChallengeParameters.USERNAME}",email="${authResult.ChallengeParameters.email}",ANSWER="${authCode}"`

      const { stdout: challengeResponse } = await exec(challengeCommand, {
        env: { ...process.env }
      })

      authResult = JSON.parse(challengeResponse)

      console.log(JSON.stringify(authResult, null, 2))
    } catch (error) {
      console.error('Authentication failed:', error.message)
      if (error.stderr) {
        console.error('AWS CLI Error:', error.stderr)
      }
      process.exit(1)
    }
  })

  const _getPaginatedSelection = async (command, listKey, choiceNameKey, choiceValueKey) => {
    let nextToken = null
    let selected = null

    while (!selected) {
      const { stdout } = await exec(`${command}${nextToken ? ` --next-token ${nextToken}` : ''}`, {
        env: {
          ...process.env
        }
      })

      const { [listKey]: items, NextToken } = JSON.parse(stdout)

      const choices = items.map((item) => ({
        name: item[choiceNameKey],
        value: item[choiceValueKey]
      }))

      if (NextToken) {
        choices.push({
          name: 'Load more...',
          value: NextToken
        })
      } else if (nextToken) {
        choices.push({
          name: 'Start over',
          value: null
        })
      }

      const selection = await select({
        message: 'Select a user pool',
        choices
      })

      if (selection === NextToken) {
        nextToken = NextToken
      } else if (selection === null) {
        nextToken = null
      } else {
        selected = selection
      }
    }

    return selected
  }
