.PHONY: build deploy

# Ensure correct Node.js version (Angular 21 requires >= 20.19)
SHELL := /bin/bash
export NVM_DIR := $(HOME)/.nvm
NVM_USE := source "$(NVM_DIR)/nvm.sh" && nvm use 20 --silent &&

build:
	$(NVM_USE) npx ng build --configuration production --base-href /trip-plan/

deploy: build
	rm -rf docs/*
	cp -r dist/trip-planning-clean/browser/* docs/
	cp docs/index.html docs/404.html
	git add docs/
	git commit -m "chore: rebuild docs/ for deployment"
	git push origin main
