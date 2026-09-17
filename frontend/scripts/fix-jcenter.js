// frontend/scripts/fix-jcenter.js
// EAS Cloud Build Hook & Native Java Monkey-Patcher

const fs = require('fs');
const path = require('path');

console.log('🚀 Running fix-jcenter.js postinstall hook...');

// 1. Remove jcenter() references from node_modules build.gradle files
function removeJCenter(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== '.bin' && file !== '.cache') {
        removeJCenter(fullPath);
      }
    } else if (file === 'build.gradle') {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('jcenter()')) {
          content = content.replace(/jcenter\(\)/g, '// jcenter()');
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`✅ Removed jcenter() from ${fullPath}`);
        }
      } catch (e) {
        // Ignore read/write errors
      }
    }
  }
}

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
removeJCenter(nodeModulesPath);

// 2. Patch ThermalPrinterModule.java directly if present in node_modules
const thermalModuleJavaPath = path.join(
  nodeModulesPath,
  'react-native-thermal-printer',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativethermalprinter',
  'ThermalPrinterModule.java'
);

if (fs.existsSync(thermalModuleJavaPath)) {
  try {
    let javaContent = fs.readFileSync(thermalModuleJavaPath, 'utf8');

    // Patch getBluetoothConnectionWithMacAddress to perform direct bonded devices lookup
    if (!javaContent.includes('BluetoothAdapter.getDefaultAdapter().getBondedDevices()') || javaContent.includes('device.getDevice().getAddress().contentEquals(macAddress)')) {
      const oldMethod = `private BluetoothConnection getBluetoothConnectionWithMacAddress(String macAddress) {
    for (BluetoothConnection device : btDevicesList) {
      if (device.getDevice().getAddress().contentEquals(macAddress))
        return device;
    }
    return null;
  }`;

      const newMethod = `private BluetoothConnection getBluetoothConnectionWithMacAddress(String macAddress) {
    if (btDevicesList != null && btDevicesList.size() > 0) {
      for (BluetoothConnection device : btDevicesList) {
        if (device != null && device.getDevice() != null && device.getDevice().getAddress() != null) {
          if (device.getDevice().getAddress().equalsIgnoreCase(macAddress))
            return device;
        }
      }
    }
    try {
      BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
      if (bluetoothAdapter != null) {
        Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
        if (pairedDevices != null) {
          for (BluetoothDevice device : pairedDevices) {
            if (device != null) {
              String dAddress = device.getAddress();
              String dName = device.getName();
              if ((dAddress != null && dAddress.equalsIgnoreCase(macAddress)) ||
                  (dName != null && dName.equalsIgnoreCase(macAddress)) ||
                  (dAddress != null && macAddress != null && dAddress.replace(":", "").equalsIgnoreCase(macAddress.replace(":", "")))) {
                return new BluetoothConnection(device);
              }
            }
          }
        }
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return null;
  }`;

      if (javaContent.includes(oldMethod)) {
        javaContent = javaContent.replace(oldMethod, newMethod);
      }

      // Add null check return on btPrinter
      if (javaContent.includes('this.jsPromise.reject("Connection Error", "Bluetooth Device Not Found");')) {
        javaContent = javaContent.replace(
          'this.jsPromise.reject("Connection Error", "Bluetooth Device Not Found");',
          'this.jsPromise.reject("Connection Error", "Bluetooth Device Not Found. Please ensure printer is paired in phone Bluetooth settings.");\n      return;'
        );
      }

      fs.writeFileSync(thermalModuleJavaPath, javaContent, 'utf8');
      console.log('✅ ThermalPrinterModule.java successfully patched by fix-jcenter.js');
    }
  } catch (err) {
    console.log('⚠️ Error patching ThermalPrinterModule.java:', err.message);
  }
}

console.log('🎉 fix-jcenter.js execution complete.');
