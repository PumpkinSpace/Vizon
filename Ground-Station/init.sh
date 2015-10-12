BASE_DIR=`dirname $0`

# change to the directory this script is running in, so work will
# be relative to a known path
TOP=$(cd $(dirname $0) && pwd)

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
sudo apt-get update

sudo apt-get install -y --force-yes \
libpq-dev \
python-dev \
openjdk-7-jre \
nodejs \
npm \
mongodb-org \

sudo service mongod start

