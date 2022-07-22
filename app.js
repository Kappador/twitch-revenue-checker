const vorpal = require("vorpal")();
const fs = require("fs");
let chalk = vorpal.chalk;
let axios = require("axios");
let proxyAgent = require("https-proxy-agent");
let config = JSON.parse(fs.readFileSync("config.json"));
let scheduler;

if (Object.keys(config).length === 0) {
  console.log(chalk.red("Please run 'setup' to configure the bot"));
}

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
      tokenFile.forEach(async (token) => {
        returnChannelInfo(token).then((info) => {
          console.log(info);
          config.tokens.push({
            name: info.displayName,
            token,
          });
          if (results.scheduler) {
            config.scheduler = {
              enabled: true,
              interval: results.scheduler_interval * 60 * 60 * 1000,
            };
          }
          fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
          this.log(chalk.green("✓") + " Setup complete");
        });
      });
    }
  });

vorpal
  .command("check")
  .description("Check the revenue of a channel")
  .action(async function () {
    const result = await this.prompt([
      {
        type: "list",
        name: "name",
        message: "Select a channel",
        choices: config.tokens.map((token) => token.name),
      },
      {
        type: "input",
        default: "30",
        name: "days",
        message: "Please enter the number of days to check: ",
      },
    ]);

    const config_token = config.tokens.find(
      (token) => token.name == result.name
    );
    const channel_info = await returnChannelInfo(config_token.token);
    fetchRevenue(result.days, config_token.token, channel_info.id).then(
      (revenue_results) => {
        this.log(
          `\nRevenue for ${chalk.cyan(
            channel_info.displayName
          )} looking ${chalk.cyan(result.days)} days back`
        );
        this.log(`Total Revenue ${chalk.cyan(revenue_results.total)}`);
        this.log(`Ads Revenue ${chalk.cyan(revenue_results.ads)}`);
        this.log(`Bits Revenue ${chalk.cyan(revenue_results.bits)}`);
        this.log(
          `Prime Subs Revenue ${chalk.cyan(revenue_results.prime_subs)}\n`
        );

        // convert days to proper date
        const date_minus_days = new Date();
        date_minus_days.setDate(date_minus_days.getDate() - result.days);
        const date_minus_days_string = date_minus_days
          .toISOString()
          .split("T")[0];
        const date = new Date();
        let description = `${date_minus_days_string} - ${
          date.toISOString().split("T")[0]
        }`;
        if (config.webhook) {
          let data = {
            username: "ImaginePaying$50ForSuchATool",
            avatar_url: "https://trollface.dk/trollfaceONE.png",
            content: "",
            tts: false,
            embeds: [
              {
                title: "Revenue for " + channel_info.displayName,
                color: 31743,
                description: description,
                author: {
                  url: "",
                },
                image: {},
                thumbnail: {},
                footer: {
                  text: "https://discord.gg/kappa | https://discord.gg/kappahost",
                },
                fields: [
                  {
                    name: "Total Revenue",
                    value: `💵 ${revenue_results.total.toString()} $`,
                    inline: true,
                  },
                  {
                    name: "Ads Revenue",
                    value: `💵 ${revenue_results.ads.toString()} $`,
                    inline: true,
                  },
                  {
                    name: "Bits Revenue",
                    value: `💵 ${revenue_results.bits.toString()} $`,
                    inline: true,
                  },
                  {
                    name: "Prime Subs Revenue",
                    value: `💵 ${revenue_results.prime_subs.toString()} $`,
                    inline: true,
                  },
                ],
              },
            ],
            components: [],
          };
          axios({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            data: JSON.stringify(data),
            url: config.webhook,
          });
        }
      }
    );
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
            const channel_info = await returnChannelInfo(token.token);
            fetchRevenue(30, token.token, channel_info.id).then(
              (revenue_results) => {
                this.log(
                  `\nRevenue for ${chalk.cyan(
                    channel_info.displayName
                  )} looking ${chalk.cyan(30)} days back`
                );
                this.log(`Total Revenue ${chalk.cyan(revenue_results.total)}`);
                this.log(`Ads Revenue ${chalk.cyan(revenue_results.ads)}`);
                this.log(`Bits Revenue ${chalk.cyan(revenue_results.bits)}`);
                this.log(
                  `Prime Subs Revenue ${chalk.cyan(
                    revenue_results.prime_subs
                  )}\n`
                );

                const date_minus_days = new Date();
                date_minus_days.setDate(date_minus_days.getDate() - 30);
                const date_minus_days_string = date_minus_days
                  .toISOString()
                  .split("T")[0];
                const date = new Date();
                let description = `${date_minus_days_string} - ${
                  date.toISOString().split("T")[0]
                }`;
                if (config.webhook) {
                  let data = {
                    username: "ImaginePaying$50ForSuchATool",
                    avatar_url: "https://trollface.dk/trollfaceONE.png",
                    content: "",
                    tts: false,
                    embeds: [
                      {
                        title: "Revenue for " + channel_info.displayName,
                        color: 31743,
                        description: description,
                        author: {
                          url: "",
                        },
                        image: {},
                        thumbnail: {},
                        footer: {},
                        fields: [
                          {
                            name: "Total Revenue",
                            value: `💵 ${revenue_results.total.toString()} $`,
                            inline: true,
                          },
                          {
                            name: "Ads Revenue",
                            value: `💵 ${revenue_results.ads.toString()} $`,
                            inline: true,
                          },
                          {
                            name: "Bits Revenue",
                            value: `💵 ${revenue_results.bits.toString()} $`,
                            inline: true,
                          },
                          {
                            name: "Prime Subs Revenue",
                            value: `💵 ${revenue_results.prime_subs.toString()} $`,
                            inline: true,
                          },
                        ],
                      },
                    ],
                    components: [],
                  };
                  axios({
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    data: JSON.stringify(data),
                    url: config.webhook,
                  });
                  setTimeout(() => {}, 2000);
                }
              }
            );
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

async function fetchRevenue(days, token, channelid, proxy = null) {
  let agent = proxy ? new proxyAgent(proxy) : null;

  let date = new Date();
  date.setDate(date.getDate() - days);
  let rfc3339_start = date.toISOString().split(".")[0] + "Z";

  let lol = new Date();
  lol.setDate(lol.getDate() + 1);
  let rfc3339_end = lol.toISOString().split(".")[0] + "Z";

  let url = `https://api.twitch.tv/kraken/channels/${channelid}/dashboard/revenues?end_date=${rfc3339_end}&fraction=day&start_date=${rfc3339_start}`;
  return new Promise((resolve, reject) => {
    axios
      .get(url, {
        headers: {
          Accept: "application/vnd.twitchtv.v5+json; charset=UTF-8",
          Authorization: "OAuth " + token,
          "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
          "Content-Type": "application/json; charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          "Twitch-API-Token": "426832becca19d4e5544edd991cda559",
        },
        httpsAgent: agent,
      })
      .then((response) => {
        let data = {};
        data["ads"] = 0.0;
        data["bits"] = 0.0;
        data["prime_subs"] = 0.0;

        response.data.ads.forEach((element) => {
          data["ads"] += parseFloat(element.amount) / 100;
        });

        response.data.bits.forEach((element) => {
          data["bits"] += parseFloat(element.amount) / 100;
        });

        response.data.prime_subscriptions.forEach((element) => {
          data["prime_subs"] += parseFloat(element.amount) / 100;
        });

        // round up to 2 decimal places
        data["ads"] = Math.round(data["ads"] * 100) / 100;
        data["bits"] = Math.round(data["bits"] * 100) / 100;
        data["prime_subs"] = Math.round(data["prime_subs"] * 100) / 100;

        data["total"] = data["ads"] + data["bits"] + data["prime_subs"];
        resolve(data);
      });
  });
}

function test() {
  let response = {
    data: {
      twitch_subscriptions: [
        { product_id: "400840638", default_price: 499, revenue: [] },
      ],
      gift_subscriptions: [
        { product_id: "400840638", default_price: 499, revenue: [] },
      ],
      ads: [
        { timestamp: "2022-06-24T00:00:00Z", amount: 97.65 },
        { timestamp: "2022-06-26T00:00:00Z", amount: 49.7 },
        { timestamp: "2022-06-29T00:00:00Z", amount: 111.3 },
        { timestamp: "2022-06-25T00:00:00Z", amount: 27.3 },
        { timestamp: "2022-06-27T00:00:00Z", amount: 67.2 },
        { timestamp: "2022-07-01T00:00:00Z", amount: 13.65 },
        { timestamp: "2022-07-07T00:00:00Z", amount: 303.45 },
        { timestamp: "2022-07-20T00:00:00Z", amount: 126 },
        { timestamp: "2022-07-09T00:00:00Z", amount: 37.8 },
        { timestamp: "2022-07-16T00:00:00Z", amount: 53.55 },
        { timestamp: "2022-07-08T00:00:00Z", amount: 229.25 },
        { timestamp: "2022-07-10T00:00:00Z", amount: 233.45 },
        { timestamp: "2022-07-18T00:00:00Z", amount: 141.05 },
        { timestamp: "2022-07-15T00:00:00Z", amount: 98.7 },
        { timestamp: "2022-07-17T00:00:00Z", amount: 320.25 },
        { timestamp: "2022-07-12T00:00:00Z", amount: 114.8 },
        { timestamp: "2022-07-06T00:00:00Z", amount: 185.5 },
      ],
      bits: [
        { timestamp: "2022-07-08T00:00:00Z", amount: 400 },
        { timestamp: "2022-07-20T00:00:00Z", amount: 1000 },
      ],
      prime_subscriptions: [
        { timestamp: "2022-07-01T00:00:00Z", amount: 878 },
        { timestamp: "2022-07-06T00:00:00Z", amount: 157 },
        { timestamp: "2022-07-10T00:00:00Z", amount: 423.5 },
        { timestamp: "2022-07-21T00:00:00Z", amount: 848.5 },
      ],
      bounty_board: [],
      ad_polls: [],
      game_commerce: [],
      extensions: [],
      polls: [],
      multi_month_gift_subscriptions: [],
      experimental: [],
    },
  };

  let data = {};

  data["ads"] = 0.0;
  data["bits"] = 0.0;
  data["prime_subs"] = 0.0;

  response.data.ads.forEach((element) => {
    data["ads"] += parseFloat(element.amount) / 100;
  });

  response.data.bits.forEach((element) => {
    data["bits"] += parseFloat(element.amount) / 100;
  });

  response.data.prime_subscriptions.forEach((element) => {
    data["prime_subs"] += parseFloat(element.amount) / 100;
  });

  // round up to 2 decimal places
  data["ads"] = Math.round(data["ads"] * 100) / 100;
  data["bits"] = Math.round(data["bits"] * 100) / 100;
  data["prime_subs"] = Math.round(data["prime_subs"] * 100) / 100;

  data["total"] = data["ads"] + data["bits"] + data["prime_subs"];
  console.log(data);
}

async function returnChannelInfo(token) {
  return new Promise((resolve, reject) => {
    axios
      .post(
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
          headers: getTwitchHeader(token),
        }
      )
      .then((response) => {
        resolve({
          name: response.data[0].data.currentUser.login,
          displayName: response.data[0].data.currentUser.displayName,
          id: response.data[0].data.currentUser.id,
        });
      });
  });
}

vorpal.delimiter("revchecker$").show();
