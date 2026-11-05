import { describe, expect, it } from 'vitest';

import { isValidCidr, isValidIp, isValidMatchValue } from './validators';

describe('blocklist validators', () => {
  it('accepts IPv4 and IPv6 literals', () => {
    expect(isValidIp('10.0.0.1')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
    expect(isValidIp('::1')).toBe(true);
    expect(isValidIp('2001:db8::1')).toBe(true);
    expect(isValidIp('::ffff:10.0.0.1')).toBe(true);
    expect(isValidIp('[2001:db8::1]:443')).toBe(true);
  });

  it('rejects malformed IP literals', () => {
    expect(isValidIp('999.1.1.1')).toBe(false);
    expect(isValidIp('1.2.3')).toBe(false);
    expect(isValidIp('example.com')).toBe(false);
    expect(isValidIp('1::2::3')).toBe(false);
    expect(isValidIp('1:2:3:4:5:6:7')).toBe(false);
  });

  it('validates CIDR prefix range', () => {
    expect(isValidCidr('10.0.0.0/8')).toBe(true);
    expect(isValidCidr('10.0.0.0/33')).toBe(false);
    expect(isValidCidr('2001:db8::/32')).toBe(true);
    expect(isValidCidr('2001:db8::/129')).toBe(false);
  });

  it('validates values by match type', () => {
    expect(isValidMatchValue('IP', '10.0.0.1')).toBe(true);
    expect(isValidMatchValue('CIDR', '10.0.0.0/8')).toBe(true);
    expect(isValidMatchValue('PATH', '/admin')).toBe(true);
    expect(isValidMatchValue('PATH', 'admin')).toBe(false);
    expect(isValidMatchValue('USER_AGENT', 'scrapy')).toBe(true);
    expect(isValidMatchValue('USER_AGENT', 'ab')).toBe(false);
  });
});
