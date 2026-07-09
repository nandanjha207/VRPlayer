import AVKit
import UIKit
import React

@objc(AirPlayRoutePickerViewManager)
class AirPlayRoutePickerViewManager: RCTViewManager {

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    let picker = AVRoutePickerView()
    picker.tintColor = UIColor(red: 0.973, green: 0.98, blue: 0.988, alpha: 1.0)
    picker.activeTintColor = UIColor(red: 0.055, green: 0.647, blue: 0.914, alpha: 1.0)
    picker.prioritizesVideoDevices = true
    return picker
  }
}
