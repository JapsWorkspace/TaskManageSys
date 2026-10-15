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

  static String get origin => 'http://$host:8000';
}
