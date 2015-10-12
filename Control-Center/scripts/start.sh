sudo pkill node
sudo pkill grunt
cd ~/Vizon-Keystone
sudo nohup grunt &
sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 1415
