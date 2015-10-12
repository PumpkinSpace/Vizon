#!/bin/sh
#
# run crontab -e
# and add 
# 00 3 * * * ~/Vizon-Keystone/scripts/cron-schedule.sh 

cd ~/Vizon-Keystone/
git pull
sudo npm update
./scripts/start.sh
