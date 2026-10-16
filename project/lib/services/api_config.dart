import 'package:flutter/foundation.dart';

class ApiConfig {
  static String get api {
    final configuredUrl = const String.fromEnvironment('API_BASE_URL').trim();
    if (configuredUrl.isNotEmpty) {
      return configuredUrl.replaceFirst(RegExp(r'/+$'), '');
    }
    return '$origin/api';
  }

  static String get host => const String.fromEnvironment(
    'API_HOST',
    defaultValue: kIsWeb ? 'localhost' : '10.0.2.2',
  );

  static String get origin {
    final configuredUrl = const String.fromEnvironment('API_BASE_URL').trim();
    final configuredUri = Uri.tryParse(configuredUrl);
    if (configuredUri != null &&
        configuredUri.hasScheme &&
        configuredUri.hasAuthority &&
        configuredUri.host.isNotEmpty) {
      return configuredUri.origin;
    }
    return 'http://$host:8000';
  }
}
