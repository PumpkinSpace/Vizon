#!/bin/bash -e
# Dumps mongo dbs and copies it somewhere else.
#
# Use with cron like:
# 00 00 * * * ./.../scripts/mongo-backup.sh
#

pushd `dirname $0` >/dev/null

BACKUP_REMOTE_USER="ec2-user"
BACKUP_REMOTE_HOST="vizon.us"        # TODO: change me!
BACKUP_REMOTE_DEST="~/backup/automated/."

NOW=`date +%s`
BACKUP_DIR="/tmp/vizon_mongo_backup_$NOW"

mongodump -d vizon -o $BACKUP_DIR

COMPRESSED_PATH="vizon_backup_${NOW}.tar.gz"
tar czvf $COMPRESSED_PATH $BACKUP_DIR

rsync -avz $COMPRESSED_PATH $BACKUP_REMOTE_USER@$BACKUP_REMOTE_HOST:$BACKUP_REMOTE_DEST

popd >/dev/null
