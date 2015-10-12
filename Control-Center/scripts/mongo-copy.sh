#!/bin/bash -e
# Creates a copy of the db and places it in the home directory
#

#if [[ $UID != 0 ]]; then
#    echo "Please run this script with sudo:"
#    echo "sudo $0 $*"
#    exit 1
#fi


# pushd `dirname $0` >/dev/null

mkdir ~/db/
sudo cp /var/lib/mongo/vizon-ii.* ~/db/
sudo chown ec2-user:ec2-user ~/db/vizon-ii.*
# popd >/dev/null
