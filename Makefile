.PHONY: build deploy

build:
	npx ng build --configuration production --base-href /trip-plan/

deploy: build
	rm -rf docs/*
	cp -r dist/trip-planning-clean/browser/* docs/
	cp docs/index.html docs/404.html
	git add docs/
	git commit -m "chore: rebuild docs/ for deployment"
	git push origin main
