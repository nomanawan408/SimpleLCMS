<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" type="image/png" href="{{ asset('assets/simplelaw-logo-primary.png') }}">
    <link rel="apple-touch-icon" href="{{ asset('assets/simplelaw-logo-primary.png') }}">
    <meta name="theme-color" content="#01B88E">
    <title inertia>{{ config('app.name', 'Simple Lawyer') }}</title>
    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="h-full bg-background font-sans antialiased">
    @inertia
</body>
</html>
