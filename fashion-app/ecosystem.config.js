module.exports = {
  apps: [{
    name: 'fashion-app',
    script: 'node_modules/.bin/next',
    args: 'start -p 3001',
    cwd: '/www/wwwroot/fz.tmsg8.com/fuzhuangjiepau/fashion-app',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
