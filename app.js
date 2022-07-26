const vorpal = require("vorpal")();
const fs = require("fs");
let chalk = vorpal.chalk;
let config = JSON.parse(fs.readFileSync("config.json"));
const needle = require("needle");
const HttpsProxyAgent = require("https-proxy-agent");
let scheduler;

if (Object.keys(config).length === 0) {
  console.log(chalk.red("Please run 'setup' to configure the bot"));
}

console.log(
  chalk.green("https://discord.gg/") +
    chalk.cyan("kappa") +
    chalk.green(" | https://discord.gg/") +
    chalk.cyan("kappahost \n\n")
);

vorpal
  .command("setup")
  .description("Setup the bot")
  .action(async function (args, callback) {
    const results = await this.prompt([
      {
        type: "input",
        name: "tokens",
        message: "File path to token file ",
        default: "./tokens.txt",
      },
      {
        type: "confirmation",
        name: "proxies",
        default: "Y",
        message: "Do you want to use proxies? ",
      },
      {
        type: "input",
        name: "webhook",
        message: "Discord Webhook ",
        default: "None",
      },
      {
        type: "input",
        name: "scheduler_interval",
        message: "Scheduler interval (in hours) ",
        default: "12",
      },
    ]);

    if (results) {
      this.log(`\n${chalk.blue("|")} Token File: ${results.tokens}`);
      this.log(`\n${chalk.blue("|")} Proxy Usage: ${results.proxies}`);
      this.log(`${chalk.blue("|")} Discord Webhook: ${results.webhook}`);
      this.log(
        `${chalk.blue("|")} Scheduler Interval: ${results.scheduler_interval}`
      );

      this.log(
        `\n${chalk.red("Disclaimer:")} ${chalk.gray(
          "To get more info about the scheduler do"
        )} ${chalk.cyan("scheduler")}\n`
      );

      const confirmation = await this.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `Did I read that right? `,
        },
      ]);

      if (!confirmation.confirm) {
        return this.log(chalk.red("X") + " Setup aborted");
      }

      const tokenFile = fs
        .readFileSync(results.tokens)
        .toString()
        .split("\r\n");
      if (tokenFile.length < 1) {
        return this.log(chalk.red("X") + " Token file is empty");
      }

      config.webhook = results.webhook == "None" ? null : results.webhook;

      config.tokens = [];
      tokenFile.forEach(async (token, index, array) => {
        returnChannelInfo({ token }).then((info) => {
          config.tokens.push({
            login: info.name,
            name: info.displayName,
            token,
            id: info.id,
            proxy: null,
          });
          if (results.scheduler) {
            config.scheduler = {
              enabled: true,
              interval: results.scheduler_interval * 60 * 60 * 1000,
            };
          }
          if (index == array.length - 1) {
            if (results.proxies != "Y")
              this.log(chalk.green("✓") + " Setup complete");
            fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
          }
        });
      });

      if (results.proxies === "Y") {
        const proxyHow = await this.prompt([
          {
            type: "list",
            name: "proxy",
            message: "How do you want to use proxies?",
            choices: [
              "Random Proxies for Account",
              "Specific Proxy for Account",
            ],
          },
        ]);

        if (proxyHow.proxy === "Random Proxies for Account") {
          let proxies = [];
          const proxyFilePrompt = await this.prompt([
            {
              type: "input",
              name: "proxyFile",
              message: "File path to proxy file ",
              default: "./proxies.txt",
            },
          ]);
          const proxyFile = fs
            .readFileSync(proxyFilePrompt.proxyFile)
            .toString()
            .split("\r\n");
          if (proxyFile.length < 1) {
            return this.log(chalk.red("X") + " Proxy file is empty");
          }

          config.tokens.forEach((token, index, array) => {
            const randomProxy =
              proxyFile[Math.floor(Math.random() * proxyFile.length)];
            token.proxy = `http://${randomProxy}`;

            if (index == array.length - 1) {
              this.log(chalk.green("✓") + " Setup complete");
              fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
            }
          });
        } else if (proxyHow.proxy === "Specific Proxy for Account") {
          const proxyFilePrompt = await this.prompt([
            {
              type: "input",
              name: "proxyFile",
              message: "File path to proxy file ",
              default: "./proxies.txt",
            },
          ]);
          const proxyFile = fs
            .readFileSync(proxyFilePrompt.proxyFile)
            .toString()
            .split("\r\n");
          if (proxyFile.length < 1) {
            return this.log(chalk.red("X") + " Proxy file is empty");
          }

          let choices = proxyFile;
          let promptArray = [];
          for (let i = 0; i < config.tokens.length; i++) {
            promptArray.push({
              type: "list",
              name: `proxy${i}`,
              message: `Select which proxy you want to use for account ${config.tokens[i].name}? `,
              choices,
            });
          }
          const whatever = await this.prompt(promptArray);
          config.tokens.forEach((token, index, array) => {
            token.proxy = `http://${whatever[`proxy${index}`]}`;

            if (index == array.length - 1) {
              this.log(chalk.green("✓") + " Setup complete");
              fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
            }
          });
        }
      }
    }
  });

vorpal
  .command("check")
  .description("Check the revenue of a channel")
  .action(async function () {
    let choices = config.tokens.map((token) => token.name);
    choices.push("All");

    const result = await this.prompt([
      {
        type: "list",
        name: "name",
        message: "Select a channel",
        choices: choices,
      },
      {
        type: "input",
        default: "30",
        name: "days",
        message: "Please enter the number of days to check: ",
      },
    ]);

    if (result.name === "All") {
      const timeoutResult = await this.prompt([
        {
          type: "input",
          default: "5",
          name: "seconds",
          message:
            "Please enter how many seconds you want to wait between each check: ",
        },
      ]);

      config.tokens.forEach((token) => {
        let agent = new HttpsProxyAgent(token.proxy);
        doTheDoings(result.days, token, agent);
        setTimeout(() => {}, timeoutResult.seconds * 1000);
      });

      return;
    }

    const config_token = config.tokens.find(
      (token) => token.name == result.name
    );
    let agent = new HttpsProxyAgent(config_token.proxy);
    doTheDoings(result.days, config_token, agent);
  });
vorpal
  .command("scheduler")
  .description("lol")
  .action(async function (args, cb) {
    const result = await this.prompt([
      {
        type: "list",
        name: "val",
        message: "What do you want to do?",
        default: 0,
        choices: [
          {
            name: config.scheduler.enabled ? "Disable" : "Enable",
            value: "change_state",
          },
          { name: "Change Interval", value: "interval" },
          {
            name: config.scheduler.running ? "Stop" : "Start",
            value: config.scheduler.running ? "stop" : "start",
          },
        ],
      },
    ]);

    if (result.val == "change_state") {
      config.scheduler.enabled = !config.scheduler.enabled;
      fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
      config.scheduler.enabled
        ? this.log(chalk.green("✓") + " Scheduler enabled")
        : this.log(chalk.red("X") + " Scheduler disabled");
    }
    if (result.val == "interval") {
      const result = await this.prompt([
        {
          type: "input",
          name: "val",
          message: "Please enter the interval in hours: ",
        },
      ]);
      config.scheduler.interval = result.val * 60 * 60 * 1000;
      fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
      this.log(chalk.green("✓") + " Scheduler interval changed");
    }
    if (result.val == "start") {
      if (config.scheduler.running) {
        this.log(chalk.red("X") + " Scheduler is already running");
      } else {
        config.scheduler.running = true;
        fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
        this.log(chalk.green("✓") + " Scheduler started");

        scheduler = setInterval(async () => {
          config.tokens.forEach(async (token) => {
            let agent = new HttpsProxyAgent(token.proxy);
            doTheDoings(30, token, agent);
            setTimeout(() => {}, 5000);
          });
        }, config.scheduler.interval);
      }
    }
    if (result.val == "stop") {
      if (!config.scheduler.running) {
        this.log(chalk.red("X") + " Scheduler is not running");
      } else {
        config.scheduler.running = false;
        fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
        this.log(chalk.green("✓") + " Scheduler stopped");
        clearInterval(scheduler);
      }
    }
  });

function getTwitchHeader(token = "") {
  const header = {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US",
    Authorization: "undefined",
    "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
    Connection: "keep-alive",
    "Content-Type": "text/plain; charset=UTF-8",
    "Device-ID": "pkXjq7q8Qownz1owUogMDR9xKbxiCrC2",
    Origin: "https://www.twitch.tv",
    Referer: "https://www.twitch.tv/",
    Authorization: "OAuth " + token,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sec-GPC": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.114 Safari/537.36",
  };
  return header;
}

async function doTheDoings(days = 30, token, agent) {
  fetchRevenue(days, token, agent).then((fetchRevenueResult) => {
    setTimeout(() => {}, 2000);
    const date_minus_days = new Date();
    date_minus_days.setDate(date_minus_days.getDate() - days);
    const date_minus_days_string = date_minus_days.toISOString().split("T")[0];
    const date = new Date();
    let description = `${date_minus_days_string} - ${
      date.toISOString().split("T")[0]
    }`;

    let data = fetchRevenueResult;
    data.displayName = token.name;
    data.description = description;
    sendWebhook(data);
  });
}

async function sendWebhook(data) {
  const date = new Date();
  const date_string = date.toISOString().toString();

  const currency =
    data.payout.currency === "USD"
      ? "$"
      : data.payout.currency === "EUR"
      ? "€"
      : data.payout.currency;

  let webhookData = {
    username: "Twitch Revenue Checker",
    avatar_url: "https://trollface.dk/trollfaceONE.png",
    content: "",
    tts: false,
    embeds: [
      {
        title: "Revenue for " + data.displayName,
        color: 31743,
        description: data.description,
        author: {
          url: "https://twitch.kappa.host",
        },
        image: {},
        thumbnail: {},
        footer: {
          text: "https://twitch.kappa.host",
          icon_url: "https://trollface.dk/trollfaceONE.png",
        },
        timestamp: date_string,
        fields: [
          {
            name: "Status",
            value:
              "```" +
              `Payout Eligible: ${data.payout.eligible ? "✅" : "❌"}\n` +
              `Partner: ${data.payout.partnerStatus ? "✅" : "❌"}\n` +
              `Affiliate: ${data.payout.affiliateStatus ? "✅" : "❌"}\n` +
              "```",
            inline: false,
          },
          {
            name: `Revenue for last ${data.revenue.days} days`,
            value:
              "```" +
              `Total: 💵 ${data.revenue.total.toString()} ${currency}\n` +
              `Ads: 💵 ${data.revenue.ads.toString()} ${currency}\n` +
              `Bits: 💵 ${data.revenue.bits.toString()} ${currency}\n` +
              `Prime Subs: 💵 ${data.revenue.prime_subs.toString()} ${currency}` +
              "```",
            inline: false,
          },
          {
            name: "Tax",
            value:
              "```" +
              `Royalty Tax: ${data.tax.royalty}%\n` +
              `Service Tax: ${data.tax.service}%\n` +
              `Total Tax: ${data.tax.service + data.tax.royalty}%` +
              "```",
            inline: false,
          },
          {
            name: "Last Payout",
            value:
              "```" +
              `Total: 💵 ${data.payout.total} ${currency}\n` +
              `Date: ${data.payout.month}-${data.payout.year}\n` +
              "```",
            inline: false,
          },
        ],
      },
    ],
    components: [],
  };
  needle('post', config.webhook, webhookData, { json: true, headers: { 'Content-Type': 'application/json' } });
}

async function fetchRevenue(days, token, agent) {
  let date = new Date();
  date.setDate(date.getDate() - days);
  let rfc3339_start = date.toISOString().split(".")[0] + "Z";

  let lol = new Date();
  lol.setDate(lol.getDate() + 1);
  let rfc3339_end = lol.toISOString().split(".")[0] + "Z";

  let url = `https://api.twitch.tv/kraken/channels/${token.id}/dashboard/revenues?end_date=${rfc3339_end}&fraction=day&start_date=${rfc3339_start}`;
  return new Promise((resolve, reject) => {
    returnPayoutEligibility(token, agent).then((v2) => {
      needle("get", url, {
        headers: {
          Accept: "application/vnd.twitchtv.v5+json; charset=UTF-8",
          Authorization: "OAuth " + token.token,
          "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          "Twitch-API-Token": "e9ec7e8f6ec7deb58fd8b1f2976cdf02",
        },
        agent: agent,
      }).then((response) => {
        let body = response.body;
        let data = {};

        data.payout = v2.payout;
        data.tax = v2.tax;

        data.revenue = {};
        data.revenue.days = days;
        data.revenue.total = 0.0;
        data.revenue.ads = 0.0;
        data.revenue.bits = 0.0;
        data.revenue.prime_subs = 0.0;

        body.ads.forEach((element) => {
          data.revenue.ads += parseFloat(element.amount) / 100;
        });

        body.bits.forEach((element) => {
          data.revenue.bits += parseFloat(element.amount) / 100;
        });

        body.prime_subscriptions.forEach((element) => {
          data.revenue.prime_subs += parseFloat(element.amount) / 100;
        });

        data.revenue.ads = Math.round(data.revenue.ads * 100) / 100;
        data.revenue.bits = Math.round(data.revenue.bits * 100) / 100;
        data.revenue.prime_subs =
          Math.round(data.revenue.prime_subs * 100) / 100;

        data.revenue.total =
          data.revenue.ads + data.revenue.bits + data.revenue.prime_subs;
        resolve(data);
      });
    });
  });
}

async function returnChannelInfo(token) {
  return new Promise((resolve, reject) => {
    needle(
      "post",
      "https://gql.twitch.tv/gql",
      [
        {
          operationName: "Settings_ProfilePage_AccountInfoSettings",
          variables: {},
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                "60a54ebcbd29e095db489ed6268f33d5fe5ed1d4fa3176668d8091587ae81779",
            },
          },
        },
      ],
      {
        json: true,
        headers: getTwitchHeader(token.token),
      }
    ).then((response) => {
      let body = response.body;
      resolve({
        name: body[0].data.currentUser.login,
        displayName: body[0].data.currentUser.displayName,
        id: body[0].data.currentUser.id,
      });
    });
  });
}

async function returnPayoutEligibility(token, agent) {
  return new Promise((resolve, reject) => {
    needle(
      "post",
      "https://gql.twitch.tv/gql",
      [
        {
          operationName: "PayoutEligibility",
          variables: {},
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                "c59902f371ff2bd4f4ad62fc4113732a1412063426a6b0f9338d7474d1766a45",
            },
          },
        },
        {
          operationName: "PayoutBalanceV2",
          variables: {},
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                "ef8862395a34090d6bbd38f845c30e362fe5517ae73470a388d753a51bb4de1e",
            },
          },
        },
        {
          operationName: "AdsSettingsSection_Query",
          variables: {
            login: token.login,
            shouldSkipCIP: false,
          },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                "2661b78ffc4a0bd4678b890693357c0eca6a4c7e2953caf700c38a250d7aab52",
            },
          },
        },
      ],
      {
        json: true,
        headers: getTwitchHeader(token.token),
        agent: agent,
      }
    ).then((response) => {
      let body = response.body;
      resolve({
        payout: {
          partnerStatus: body[2].data.user.roles.isPartner,
          affiliateStatus: body[2].data.user.roles.isAffiliate,
          eligible: body[1].data.currentUser.payableStatus.isPayable
            ? true
            : false,
          total:
            body[1].data.currentUser.payoutBalance.currentPayoutBalanceAmount,
          currency: body[1].data.currentUser.payoutBalance.currency,
          month: body[1].data.currentUser.payoutBalance.month,
          year: body[1].data.currentUser.payoutBalance.year,
        },
        tax: {
          royalty: body[0].data.currentUser.withholdingTaxDetail.royaltyTaxRate,
          service: body[0].data.currentUser.withholdingTaxDetail.serviceTaxRate,
        },
        id: body[0].data.currentUser.id,
      });
    });
  });
}

vorpal.delimiter("revchecker$").show();
