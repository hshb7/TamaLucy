// What she sees when she opens a blocked app during a focus session: the fox.
import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        foxShield()
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        foxShield()
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        foxShield()
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        foxShield()
    }

    private func foxShield() -> ShieldConfiguration {
        let shared = Shared.defaults
        let fox = shared.string(forKey: Shared.Key.foxName) ?? "your fox"
        let endsAt = shared.double(forKey: Shared.Key.endsAt)
        let minutes = max(1, Int((endsAt - Date().timeIntervalSince1970) / 60 + 0.99))
        let left = endsAt > 0 ? " only \(minutes) minute\(minutes == 1 ? "" : "s") to go." : ""

        let cocoa = UIColor(red: 0.29, green: 0.165, blue: 0.133, alpha: 1)
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialLight,
            backgroundColor: UIColor(red: 1, green: 0.957, blue: 0.91, alpha: 1),
            icon: UIImage(named: "FoxStudy"),
            title: ShieldConfiguration.Label(text: "\(fox) is studying ✿", color: cocoa),
            subtitle: ShieldConfiguration.Label(text: "this can wait.\(left) you’ve got this!", color: cocoa.withAlphaComponent(0.7)),
            primaryButtonLabel: ShieldConfiguration.Label(text: "back to studying", color: .white),
            primaryButtonBackgroundColor: UIColor(red: 0.91, green: 0.45, blue: 0.55, alpha: 1),
            secondaryButtonLabel: ShieldConfiguration.Label(text: "use it anyway (ends the session)", color: cocoa.withAlphaComponent(0.7))
        )
    }
}
