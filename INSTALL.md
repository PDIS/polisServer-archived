# Install polis on Ubuntu
## Prerequest
Install nodejs 10.14.2: https://github.com/nodesource/distributions/blob/master/README.md#deb

If you have newer nodes, install nvm, since `libpq` and `pg-native` does not support node 11+, and gulp 4 does not completely support node 12+:
https://github.com/nvm-sh/nvm/blob/master/README.md#install--update-script

```
nvm install 8.0.0
nvm use 8.0.0
```

Install PostgreSQL 10+:
https://www.postgresql.org/download/linux/ubuntu/
You need `postgresql-10`, `postgresql-server-dev-all`, and `libpq-dev` packages.

## File Server
```git clone https://github.com/colinmegill/polisFileServer
cd polisFileServer
mv config.json.template config.json  # If you need to change port, modify config.json.
npm install
mkdir preprod  # match that in config.json
node fileServer.js
```
This repository is not public, please contact pol.is if you need.
## Build and copy static files
### Generate participation
Install gulp 4+ and bower:
```
sudo npm install -g gulp
sudo npm install -g bower
```
Then:
```
git clone -b local-polis https://github.com/PDIS/polisClientParticipation
cd polisClientParticipation
mv polis.config.template.js polis.config.js  # Also edit the config file
npm install
bower install
gulp
```
That's it. (Well the Admin is not rewritten yet)

### Generate admin files
```
git clone -b local-polis https://github.com/PDIS/polisClientAdmin
cd polisClientAdmin
npm install
mv polis.config.json.template.js polis.config.json.js  # Modify domain.whitelist to your server
nvm install v6.10.3  # Many updated modules don't have backward compatibility
./deployPreprod
```
Then you will get error and exit, but no matter. We just use cp rather than scp uploads:
```cp -r dist/* ~/polisFileServer/preprod/```
## Main Server

Create roles and database:
```
sudo su - postgres
psql
CREATE ROLE <yourname> SUPERUSER LOGIN;        
CREATE ROLE polis SUPERUSER LOGIN PASSWORD '<password>';
CREATE DATABASE polis;
\q  // Exit psql shell
```
Ctrl-D to Log out back to your account, download polisServer:
```
git clone -b local-polis https://github.com/PDIS/polisServer
```
Config database:
```
cd polisServer/postgres
psql -f db_setup_draft.sql polis
psql polis
grant all privileges on all tables in schema public to polis;
grant all privileges on all sequences in schema public to polis;
grant all privileges on all functions in schema public to polis;
\q
cd ..
```
Install building tools and modules:
```
sudo apt install build-essential
npm install
npm install forever
```
Modify environment variables in `run` script and `HIDDEN_ENV_EXPORT`, then 
```
./run
```

### Use nginx reverse-server
In our case, we use `nginx` reverse proxy to redirect outside traffic to polisServer. Also, our network does not allow HTTP connections, so there's some workaround.
This is the setting of `nginx`:
```
server {
  listen 80;
  server_name polis.pdis.nat.gov.tw;

  return 301 https://polis.pdis.nat.gov.tw;
}


server {
  listen 443 ssl http2;
  server_name polis.pdis.nat.gov.tw;

  ssl_certificate <crt file path>;
  ssl_certificate_key <key file path>;
  ssl_dhparam <pem file path>;
  ssl_session_cache <cache>;
  ssl_session_timeout 10m;
  ssl_protocols <protocals>;
  ssl_ciphers <your cipher>
  ssl_prefer_server_ciphers on;

  location / {
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://localhost:5000;
  }
}

server {
  listen 443 ssl http2;
  server_name polis-files.pdis.nat.gov.tw;

  ssl_certificate <crt file path>;
  ssl_certificate_key <key file path>;
  ssl_dhparam <pem file path>;
  ssl_session_cache <cache>;
  ssl_session_timeout 10m;
  ssl_protocols <protocals>;
  ssl_ciphers <your cipher>
  ssl_prefer_server_ciphers on;

  location / {
    proxy_pass http://localhost:5044;
  }
}
```

## Math Server

Install `lein`, then:
```
git clone https://github.com/PDIS/polisMath
```

Create a `run` file in `polisMath` — make sure MATH_ENV agrees with the main server

```
export MATH_ENV=prod
export SERVER_PORT=5000
export DATABASE_URL=postgres://polis:polis@localhost:5432/polis?ssl=false

lein trampoline run full &
```


# Install polis on CentOS 6/7 (Outdated)

## Prerequest
Install npm and nvm and postgresql:
```
sudo yum install nodejs
sudo yum install npm
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
yum install postgresql postgresql-server 
```
Then restart your bash console to make nvm path export work.
Also, you need `libpq`. On CentOS install `postgresql-devel` or `lib-pq`.

## File Server
```git clone https://github.com/colinmegill/polisFileServer
cd polisFileServer
mv config.json.template config.json  # If you need to change port, modify config.json.
npm install
mkdir preprod  # match that in config.json
node fileServer.js
```
This repository is not public, contact pol.is if you need.
## Build and copy static files
### New method
Require `node.js` 10+:
```
git clone https://github.com/PDIS/polisClientParticipation
npm install
mv polis.config.template.js polis.config.js  # Also edit the config file
gulp
```
That's it. (Well the Admin is not rewritten yet)

### Old method
Ensure file server is running, then back to your home root:
```
git clone https://github.com/pol-is/polisClientAdmin
git clone https://github.com/pol-is/polisClientParticipation
```
### .polis_scp_creds_client.json
Create a file named .polis_scp_creds_client.json with content below:
```
{
   "host": "localhost",
   "username": "user",
   "password": "password",
   "dest": "/home/user/polisFileServer/"
}
```
You need to create this in both polisClientAdmin and polisClientParticipation directory.
### Generate admin files
```
cd polisClientAdmin
npm install
mv polis.config.json.template.js polis.config.json.js  # Modify domain.whitelist to your server
nvm install v6.10.3
./deployPreprod
```
Then you will get error and exit, but no matter. We just use cp rather than scp uploads:
```cp -r dist/* ~/polisFileServer/preprod/```
### Generate participation
Back to your home root again,
```
cd polisClientParticipation
mv polis.config.template.js polis.config.js  # Modify config as your need
npm install -g bower
./doInstall
./deployPreprod
cp -r dist/* ~/polisFileServer/preprod/
```
## Main Server (Development Version)
Install postgresql on your server (https://www.digitalocean.com/community/tutorials/how-to-install-and-use-postgresql-on-centos-6)
Create roles and database:
```
sudo useradd polis
sudo passwd polis  // Set Linux user password
su - postgres
psql
CREATE ROLE <yourname> SUPERUSER LOGIN;        
CREATE ROLE polis SUPERUSER LOGIN PASSWORD '<password>';
CREATE DATABASE polis;
\q  // Exit psql shell
```
Log out back to your account, download polisServer:
```
git clone https://github.com/pol-is/polisServer.git
Config database:
cd polisServer/postgres
psql -f db_setup_draft.sql polis
psql polis
grant all privileges on all tables in schema public to polis;
grant all privileges on all sequences in schema public to polis;
grant all privileges on all functions in schema public to polis;
\q
cd ..
```
Install node modules:
```
nvm install v10.14.2
nvm use v10.14.2
nvm alias default v10.14.2
npm install
```
Config polisServer:
```
cp .env_dev_local_db_template .env_dev
```
Modify .env_dev's ```export DATABASE_URL=postgres://your_pg_username:your_pg_password@localhost:5432/your_pg_database_name```
line to ```polis:(password you set)@.../polis```, and other config you need to change (like static file host or server host)
To execute polisServer, you need a script to set environment variables. Create a script called run:
`./x`
## Main Server (Production Version)
In our case, we use `nginx` reverse proxy to redirect outside traffic to polisServer. Also, our network does not allow HTTP connections, so there's some workaround.
This is the setting of `nginx`:
```
server {
  listen 80;
  server_name polis.pdis.nat.gov.tw;

  return 301 https://polis.pdis.nat.gov.tw;
}


server {
  listen 443 ssl http2;
  server_name polis.pdis.nat.gov.tw;

  ssl_certificate <crt file path>;
  ssl_certificate_key <key file path>;
  ssl_dhparam <pem file path>;
  ssl_session_cache <cache>;
  ssl_session_timeout 10m;
  ssl_protocols <protocals>;
  ssl_ciphers <your cipher>
  ssl_prefer_server_ciphers on;

  location / {
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://localhost:5000;
  }
}

server {
  listen 443 ssl http2;
  server_name polis-files.pdis.nat.gov.tw;

  ssl_certificate <crt file path>;
  ssl_certificate_key <key file path>;
  ssl_dhparam <pem file path>;
  ssl_session_cache <cache>;
  ssl_session_timeout 10m;
  ssl_protocols <protocals>;
  ssl_ciphers <your cipher>
  ssl_prefer_server_ciphers on;

  location / {
    proxy_pass http://localhost:5044;
  }
}
```
Execute polisFileServer in background using `forever`:
```
forever start -o log/fsOut.log -e log/fsErr.log --sourceDir <fileServer path> --workingDir <fileServer path> fileServer.js
And execute polisServer in background using forever:
export DEV_MODE=true
export MATH_ENV=prod
export STATIC_FILES_HOST=localhost
export STATIC_FILES_PORT=5044
export STATIC_FILES_ADMINDASH_PORT=5044
export DOMAIN_OVERRIDE=polis.pdis.nat.gov.tw
export PORT=5000
export DATABASE_URL=postgres://polis:polis@localhost:5432/polis
export DATABASE_FOR_READS_NAME=DATABASE_URL
export DISABLE_INTERCOM=true
export ADMIN_UIDS="[]"
export ADMIN_EMAILS='["<your email address>"]'
export ADMIN_EMAIL_DATA_EXPORT="[]"
export ADMIN_EMAIL_DATA_EXPORT_TEST=[]
export ADMIN_EMAIL_EMAIL_TEST=[]
export DISABLE_SPAM_CHECK=false

forever start -c "node --max_old_space_size=400 --gc_interval=100 --harmony" -o log/mainOut.log -e log/mainErr.log app.js
```

## Math Server (production version)

Create a `run` file in `polisMath` — make sure MATH_ENV agrees with the main server

```
export LOCAL_SERVER=true
export MATH_ENV=prod
export STATIC_FILES_ORIGIN=http://localhost:5044
export DOMAIN_OVERRIDE=polis.pdis.nat.gov.tw
export PORT=5000
export DATABASE_URL=postgres://polis:polis@localhost:5432/polis?ssl=false
export DATABASE_FOR_READS_NAME=DATABASE_URL
export DISABLE_INTERCOM=true
export ADMIN_UIDS="[]"
export ADMIN_EMAILS='["romulus@ey.gov.tw"]'
export ADMIN_EMAIL_DATA_EXPORT="[]"
export ADMIN_EMAIL_DATA_EXPORT_TEST=[]
export ADMIN_EMAIL_EMAIL_TEST=[]
export DISABLE_SPAM_CHECK=false

lein run full
```
# TroubleShooting
## node-gyp ERROR when npm install
Install C++11 compiler: https://edwards.sdsu.edu/research/c11-on-centos-6/
## Ident authentication failed for user "polis"
https://qiita.com/tomlla/items/9fa2feab1b9bd8749584
Find your pg_hba.conf (In my case at /var/lib/pgsql/10/data/pg_hba.conf), then change
host    all             all             127.0.0.1/32            ident
to

host    all             all             127.0.0.1/32            md5
then

/etc/init.d/postgresql-10 restart
## npm ERR! github.com[0: 192.30.253.112]: errno=Connection timed out
npm ERR! Command failed: git clone --template=/home/romulus/.npm/_git-remotes/_templates --mirror git://github.com/mbjorkegren/gulp-s3.git /home/romulus/.npm/_git-remotes/git-github-com-mbjorkegren-gulp-s3-git-847e2b372204b4ceeccb0e9b567f28ff00e7fa1d-64afa539
Your network does not allow git:// protocol. Change all git:// appearance in package.json to https://.
## My server's network does not allow uploading or bower fails or any other issues when generating static files
Static files can be generated in other places, then simply copied to the production server. So prepare another develop machine in a free network, then copy files in two /dist directory will do the work.
## Failed at the libpq@1.8.8 install script 'node-gyp rebuild'.
Or which: no pg_config in ...
You need to install build tools like postgresql-devel or lib-pq first, depending on your OS.
Try to update your gcc or ld, etc.
If postgresql is installed but the error still occurs, use locate pg_config to find path, and add it to $PATH.
## "Tried to use insecure HTTP repository without TLS" when trying to run polisMath
Modify project.clj in polisMath folder, and change all http:// to https://.
## ERROR [polismath.components.postgres:107] - polling failed The server does not support SSL.
　org.postgresql.util.PSQLException: The server does not support SSL.
You need to use a SSL enabled postgreSQL server.
## Segmentation Fault when running server
You need to use `nodejs` version 10 or later.
## handlebones error
You may see only a index file in bower_components/handlebones. Just git clone the source to `handlebones` directory.
## ../src/connection.cc:204:52: error: no matching function for call to ‘v8::Value::Int32Value()’
`libpq` does not support node 10. Remove `pg-native` package.
## bcrypt error
`npm install bcrypt`
