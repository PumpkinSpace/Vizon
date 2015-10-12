Vagrant.configure('2') do |config|
  vm_ram = ENV['VAGRANT_VM_RAM'] || 2048
  vm_cpu = ENV['VAGRANT_VM_CPU'] || 2

  config.vm.box = "precise64"
  config.vm.box_url = 'http://files.vagrantup.com/precise64.box'
  config.vm.network :forwarded_port, guest: 22, host: 3435

  config.vm.provider :virtualbox do |vb|
    vb.customize ["modifyvm", :id, "--memory", vm_ram, "--cpus", vm_cpu]
  end

  config.vm.synced_folder "./", "/Vizon-Ground-Station"

  config.vm.provision :shell, :inline => "/vagrant/init.sh"

end
